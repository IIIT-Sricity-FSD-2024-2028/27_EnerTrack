/**
 * overviewPage.js — Technician (Jr) Overview
 * Real, per-technician counts derived from /work-orders — nothing here is
 * mock data or a fabricated "today"/"this week" claim, since work orders
 * carry no timestamp to compute that from.
 */

var currentUser = { user_id: null, name: "—", role: "Technician" };
var allWorkOrders = [];

document.addEventListener("DOMContentLoaded", function () {
  try {
    var stored = localStorage.getItem("currentUser");
    if (stored) {
      var u = JSON.parse(stored);
      currentUser.user_id = u.user_id;
      currentUser.name = u.name;
      currentUser.role = u.role;
    }
    loadPage();
  } catch (err) {
    console.error("TechJrOverview init error:", err);
  }
});

async function loadPage() {
  try {
    var results = await Promise.all([api.get("/users"), api.get("/work-orders")]);
    var allUsers = Array.isArray(results[0]) ? results[0] : [];
    allWorkOrders = Array.isArray(results[1]) ? results[1] : [];

    if (!currentUser.user_id && currentUser.name) {
      var found = allUsers.find(function (u) {
        return u.name === currentUser.name;
      });
      if (found) currentUser.user_id = found.user_id;
    }
  } catch (err) {
    console.warn("[TechJrOverview] Failed to load:", err.message);
    showToast("Failed to load your work orders: " + err.message, "error");
  }

  renderStats();
  renderUpNext();
}

function renderStats() {
  var mine = allWorkOrders.filter(function (w) {
    return w.assigned_to_id === currentUser.user_id;
  });
  var open = mine.filter(function (w) {
    return w.status === "new";
  });
  var inProgress = mine.filter(function (w) {
    return w.status === "inprogress" || w.status === "approval";
  });
  var review = mine.filter(function (w) {
    return w.status === "review";
  });
  var closed = mine.filter(function (w) {
    return w.status === "closed";
  });
  var highPriority = open.filter(function (w) {
    return w.priority === "high" || w.priority === "immediate";
  });

  setEl("statOpen", open.length);
  setEl("statInProgress", inProgress.length);
  setEl("statReview", review.length);
  setEl("statClosed", closed.length);

  setEl("noteOpen", highPriority.length + " high priority");
  setEl(
    "noteInProgress",
    inProgress.filter(function (w) {
      return w.status === "approval";
    }).length + " awaiting cost approval",
  );
  setEl("noteReview", "Waiting on Technician Administrator");
  setEl("noteClosed", mine.length + " total assigned");
}

function renderUpNext() {
  var container = document.getElementById("upNextList");
  if (!container) return;

  var mine = allWorkOrders.filter(function (w) {
    return (
      w.assigned_to_id === currentUser.user_id && w.status !== "closed"
    );
  });

  var order = { immediate: 0, high: 1, medium: 2, low: 3 };
  mine.sort(function (a, b) {
    return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
  });

  if (!mine.length) {
    container.innerHTML =
      '<div class="empty-state">Nothing on your board right now.</div>';
    return;
  }

  container.innerHTML = mine
    .slice(0, 6)
    .map(function (wo) {
      var id = wo.work_order_id || wo.id;
      var shortId =
        "WO-" + (id.split("-")[1] || id.slice(0, 4)).toUpperCase();
      return (
        '<a class="up-next-item" href="technician_jr_work_orders.html">' +
        '<span class="up-next-id">' +
        shortId +
        "</span>" +
        '<span class="up-next-title">' +
        wo.title +
        "</span>" +
        '<span class="priority-tag priority-' +
        wo.priority +
        '">' +
        cap(wo.priority) +
        "</span>" +
        "</a>"
      );
    })
    .join("");
}

function setEl(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

function cap(str) {
  if (!str) return "—";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function showToast(msg, type) {
  var container = document.getElementById("et-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "et-toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  var toast = document.createElement("div");
  toast.className = "toast toast--" + (type || "info");
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(function () {
    toast.remove();
  }, 3500);
}
