/**
 * workOrdersPage.js  —  Technician Jr (Teja) Work Orders
 * Wired to the real NestJS backend via window.api (api.js).
 *
 * Backend field → UI mapping:
 *   work_order_id  → card id, detail panel title
 *   assigned_to_id → resolved to user name via /users
 *   title          → card body text
 *   priority       → priority-tag colour class
 *   status         → kanban column (new / inprogress / review / approval / closed)
 */

/* ─── State ─────────────────────────────────────── */
var currentUser = { user_id: null, name: "—", role: "Technician" };
var allWorkOrders = []; // raw array from backend
var allUsers = []; // user lookup cache
var selectedWOId = null;

var actionPanelTitle = null;
var actionPanelOptions = null;

/* ─── Boot ───────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", function () {
  try {
    var stored = localStorage.getItem("currentUser");
    if (stored) {
      var u = JSON.parse(stored);
      currentUser.user_id = u.user_id;
      currentUser.name = u.name;
      currentUser.role = u.role;
    }

    actionPanelTitle = document.getElementById("actionPanelTitle");
    actionPanelOptions = document.getElementById("actionPanelOptions");

    loadPage();
  } catch (err) {
    console.error("WorkOrdersPage init error:", err);
  }
});

async function loadPage() {
  try {
    // Fetch users (for name lookup) and work orders in parallel
    var results = await Promise.all([
      api.get("/users"),
      api.get("/work-orders"),
    ]);
    allUsers = results[0];
    allWorkOrders = results[1];

    // Fallback for stale sessions missing user_id
    if (!currentUser.user_id && currentUser.name) {
      var foundUser = allUsers.find(function(u) { return u.name === currentUser.name; });
      if (foundUser) {
        currentUser.user_id = foundUser.user_id;
      }
    }

    console.log("[WorkOrders] Current user:", currentUser);
    console.log("[WorkOrders] All work orders:", allWorkOrders);
    console.log("[WorkOrders] Work orders assigned to this user:", allWorkOrders.filter(function(wo) { return wo.assigned_to_id === currentUser.user_id; }));

    renderBoard();
    renderArchive();

    // Auto-select first active WO assigned to this user
    var mine = allWorkOrders.filter(function (wo) {
      return (
        wo.assigned_to_id === currentUser.user_id && wo.status !== "closed"
      );
    });
    if (mine.length > 0) selectWorkOrder(mine[0].work_order_id);

    console.log(
      "[WorkOrders] Loaded",
      allWorkOrders.length,
      "orders from backend. Found",
      mine.length,
      "assigned to current user.",
    );
  } catch (err) {
    console.error("[WorkOrders] Failed to load:", err.message);
    showToast("Failed to load work orders: " + err.message, "error");
  }
}

/* ─── Name lookup helper ─────────────────────────── */
function getUserName(userId) {
  if (!userId) return "—";
  var found = allUsers.find(function (u) {
    return u.user_id === userId;
  });
  return found ? found.name : userId.slice(0, 8) + "…";
}

/* ─── Kanban Board ───────────────────────────────── */
function renderBoard() {
  renderColumn("woColNew", "new");
  renderColumn("woColApproval", "approval");
  renderColumn("woColInProgress", "inprogress");
  renderColumn("woColReview", "review");
  updateColumnCounts();
}

function renderColumn(containerId, status) {
  var container = document.getElementById(containerId);
  if (!container) return;

  // Show all WOs for this status assigned to the logged-in user
  var orders = allWorkOrders.filter(function (wo) {
    return wo.status === status && wo.assigned_to_id === currentUser.user_id;
  });

  container.innerHTML =
    orders
      .map(function (wo) {
        return (
          '<div class="task-card ' +
          (wo.work_order_id === selectedWOId ? "selected-task" : "") +
          '" data-wo-id="' +
          wo.work_order_id +
          '">' +
          '<div class="task-title">' +
          "WO-" +
          wo.work_order_id.split("-")[1].toUpperCase() +
          '<span class="priority-tag priority-' +
          wo.priority +
          '">' +
          cap(wo.priority) +
          "</span>" +
          "</div>" +
          "<div>" +
          wo.title +
          "</div>" +
          '<div class="task-meta">' +
          '<span class="task-meta-row">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
          getUserName(wo.assigned_to_id) +
          "</span>" +
          "</div>" +
          "</div>"
        );
      })
      .join("") || '<div class="empty-state">No work orders</div>';

  container.querySelectorAll(".task-card").forEach(function (card) {
    card.addEventListener("click", function () {
      selectWorkOrder(card.dataset.woId);
    });
  });
}

function updateColumnCounts() {
  var counts = { new: 0, approval: 0, inprogress: 0, review: 0 };
  allWorkOrders
    .filter(function (wo) {
      return wo.assigned_to_id === currentUser.user_id;
    })
    .forEach(function (wo) {
      if (counts[wo.status] !== undefined) counts[wo.status]++;
    });
  setEl("countNew", counts.new);
  setEl("countApproval", counts.approval);
  setEl("countInProgress", counts.inprogress);
  setEl("countReview", counts.review);
}

/* ─── Select a Work Order ────────────────────────── */
function selectWorkOrder(id) {
  selectedWOId = id;
  var wo = allWorkOrders.find(function (w) {
    return w.work_order_id === id;
  });
  if (!wo) return;

  // Highlight selected card
  document.querySelectorAll(".task-card").forEach(function (c) {
    c.classList.remove("selected-task");
  });
  var card = document.querySelector('.task-card[data-wo-id="' + id + '"]');
  if (card) card.classList.add("selected-task");

  // Detail panel
  setEl(
    "selectedWOTitle",
    "Selected Work Order — WO-" + wo.work_order_id.split("-")[1].toUpperCase(),
  );
  setEl("selectedWOStatus", cap(wo.status));
  setEl(
    "selectedWOType",
    wo.linked_fault_id ? "Fault Repair" : "Service Request",
  );
  setEl("selectedWOPriority", cap(wo.priority));
  setEl("selectedWOTechnician", getUserName(wo.assigned_to_id));

  // Cost estimate display — estimateRequired is set by the Technician
  // Administrator when the work order is created (defaults to required for
  // older records that predate the field), so "not required" WOs must never
  // show a "Required" prompt or a way to submit one.
  var estimateRequired = !(wo.details && wo.details.estimateRequired === false);
  var costStatusEl = document.getElementById("selectedWOCost");
  if (costStatusEl) {
    if (wo.details && wo.details.estimate) {
      if (wo.status === "approval") {
        costStatusEl.innerHTML = '<span class="cost-status cost-status--pending">Pending Approval (₹' + wo.details.estimate.total + ')</span>';
      } else {
        costStatusEl.innerHTML = '<span class="cost-status cost-status--approved">Approved (₹' + wo.details.estimate.total + ')</span>';
      }
    } else if (!estimateRequired) {
      costStatusEl.innerHTML =
        '<span class="cost-status cost-status--not-required">Not required</span>';
    } else {
      costStatusEl.innerHTML =
        '<span class="cost-status cost-status--not-submitted">Not yet submitted</span>';
    }
  }

  // Toggle cost form button
  var btnShowForm = document.getElementById("btnShowCostForm");
  var costEstBlock = document.getElementById("costEstimateBlock");
  if (btnShowForm && costEstBlock) {
    costEstBlock.style.display = "none";
    if ((wo.details && wo.details.estimate) || !estimateRequired) {
      btnShowForm.style.display = "none";
    } else {
      btnShowForm.style.display = "block";
      btnShowForm.onclick = function () {
        costEstBlock.style.display =
          costEstBlock.style.display === "none" ? "block" : "none";
      };
    }
  }

  // Action panel
  renderActionPanel(wo);

  // Execution flow
  updateTaskFlow(wo.status);
}

function renderActionPanel(wo) {
  if (!actionPanelTitle || !actionPanelOptions) return;

  var id = wo.work_order_id;

  if (wo.status === "new") {
    // The only state with a real 2-way choice — keep the side-by-side grid.
    actionPanelOptions.className = "grid2";
    actionPanelTitle.textContent = "Work Order Assignment";
    actionPanelOptions.innerHTML =
      '<div class="option active">' +
      "<b>Accept Task</b>" +
      "<p>Begin phase execution.</p>" +
      '<button class="btn btn-dark btn-full" onclick="acceptWO(\'' +
      id +
      "')\">Accept Task</button>" +
      "</div>" +
      '<div class="option">' +
      "<b>Reject Task</b>" +
      "<p>Return work order to the queue.</p>" +
      '<button class="btn btn-light btn-full" style="color:var(--red); border-color:var(--red);" onclick="rejectWO(\'' +
      id +
      "')\">Reject</button>" +
      "</div>";
  } else if (wo.status === "inprogress") {
    // Only one real action here — a 2-column grid would just stretch it
    // into a wide, mostly-empty box, so render it as plain content instead.
    actionPanelOptions.className = "";
    actionPanelTitle.textContent = "System Operational Check";
    actionPanelOptions.innerHTML =
      '<p class="sub mb-10">Document completion.</p>' +
      '<textarea id="completionNotes" placeholder="Enter resolution details..." style="min-height:60px; margin-bottom:8px;"></textarea>' +
      '<button class="btn btn-dark btn-full" onclick="submitForReview(\'' +
      id +
      "')\">Submit for Review</button>";
  } else if (wo.status === "approval") {
    actionPanelOptions.className = "";
    actionPanelTitle.textContent = "Cost Estimate Approval";
    actionPanelOptions.innerHTML =
      '<p style="font-size:13px; color:var(--muted);">Waiting for Finance Analyst to approve the submitted estimate...</p>';
  } else if (wo.status === "review") {
    actionPanelOptions.className = "";
    actionPanelTitle.textContent = "Under Review";
    actionPanelOptions.innerHTML =
      '<p style="font-size:13px; color:var(--muted);">Task is under review by the Technician Administrator.</p>';
  } else {
    actionPanelOptions.className = "";
    actionPanelTitle.textContent = "Work Order Closed";
    actionPanelOptions.innerHTML =
      '<p style="font-size:13px; color:var(--muted);">This work order has been closed.</p>';
  }
}

function updateTaskFlow(status) {
  var steps = ["schedule", "inspect", "perform", "test"];
  var activeIndex =
    status === "new"
      ? 0
      : status === "inprogress"
        ? 1
        : status === "review"
          ? 2
          : 3;
  steps.forEach(function (s, i) {
    var el = document.getElementById("step-" + s);
    if (el) el.classList.toggle("active", i <= activeIndex);
  });
}

/* ─── Actions (call backend, then refresh local state) ─ */
async function patchWO(id, patch) {
  var updated = await api.patch("/work-orders/" + id, patch);
  // Update local cache
  var idx = allWorkOrders.findIndex(function (w) {
    return w.work_order_id === id;
  });
  if (idx !== -1) allWorkOrders[idx] = updated;
  renderBoard();
  selectWorkOrder(id);
  renderArchive();
}

window.acceptWO = async function (id) {
  try {
    await patchWO(id, { status: "inprogress" });
    showToast("Task accepted. Procedural tracking started.", "success");
  } catch (err) {
    showToast("Failed to accept task: " + err.message, "error");
  }
};

window.rejectWO = async function (id) {
  try {
    // Unassign (return to queue by clearing assigned_to_id, resetting to new)
    await patchWO(id, { status: "new", assigned_to_id: null });
    showToast("Work order returned to queue.", "info");
  } catch (err) {
    showToast("Failed to reject task: " + err.message, "error");
  }
};

window.submitForReview = async function (id) {
  try {
    await patchWO(id, { status: "review" });
    showToast("Work order submitted for review.", "success");
  } catch (err) {
    showToast("Failed to submit for review: " + err.message, "error");
  }
};

window.submitCostEstimate = async function (id) {
  var materials = parseFloat(document.getElementById("estMaterials").value);
  var labor = parseFloat(document.getElementById("estLabor").value);
  if (isNaN(materials) || isNaN(labor)) {
    showToast("Please enter valid numeric costs.", "warning");
    return;
  }
  try {
    var wo = allWorkOrders.find(function (w) { return w.work_order_id === id; });
    var details = wo && wo.details ? Object.assign({}, wo.details) : {};
    details.estimate = { materials: materials, labor: labor, total: materials + labor };

    await patchWO(id, { status: "approval", details: details });
    document.getElementById("costEstimateBlock").style.display = "none";
    showToast("Cost estimate submitted. Awaiting approval.", "success");
  } catch (err) {
    showToast("Failed to submit estimate: " + err.message, "error");
  }
};

document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("btnSubmitCostEst");
  if (btn)
    btn.addEventListener("click", function () {
      if (selectedWOId) window.submitCostEstimate(selectedWOId);
    });
});

/* ─── Archive table ──────────────────────────────── */
function renderArchive() {
  var tbody = document.getElementById("archiveBody");
  if (!tbody) return;

  var closed = allWorkOrders.filter(function (wo) {
    return wo.status === "closed" && wo.assigned_to_id === currentUser.user_id;
  });

  if (!closed.length) {
    tbody.innerHTML =
      '<tr><td colspan="5"><div class="empty-state">No archived work orders yet.</div></td></tr>';
    return;
  }

  tbody.innerHTML = closed
    .map(function (wo) {
      return (
        "<tr>" +
        "<td>WO-" +
        wo.work_order_id.split("-")[1].toUpperCase() +
        "</td>" +
        "<td>" +
        wo.title +
        "</td>" +
        '<td><span class="badge">' +
        cap(wo.priority) +
        "</span></td>" +
        "<td>" +
        getUserName(wo.assigned_to_id) +
        "</td>" +
        '<td><span class="badge closed">Closed</span></td>' +
        "</tr>"
      );
    })
    .join("");
}

/* ─── Helpers ─────────────────────────────────────── */
function cap(str) {
  if (!str) return "—";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function setEl(id, val) {
  var el = document.getElementById(id);
  if (!el) return;
  if (String(val).includes("<svg")) el.innerHTML = val;
  else el.textContent = val;
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
