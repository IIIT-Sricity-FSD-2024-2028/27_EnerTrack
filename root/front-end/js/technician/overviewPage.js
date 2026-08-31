/**
 * overviewPage.js
 * Handles interactivity for the Technician Overview page.
 *
 * Stat cards and Quick Actions are derived entirely from real backend data
 * (/alerts, /faults, /work-orders, /service-requests) — there is no mock
 * "live feed" here. None of these entities carry a created/updated
 * timestamp today, so anything phrased as "in the last hour" or "today"
 * would be fabricated; every note below is a genuine, computable breakdown
 * instead (e.g. "3 acknowledged, 2 unread").
 */
import TechDB from "./data/mockData.js";
import { showToast } from "./utils/utils.js";

let _alerts = [];
let _faults = [];
let _workOrders = [];
let _serviceRequests = [];

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadData();
    renderStats();
    renderQuickActions();
    renderVerifyFeed();
    wireQueueButton();
    console.log("TechOverview: Initialized.");
  } catch (err) {
    console.error("TechOverview: Init error:", err);
  }
});

async function loadData() {
  try {
    if (window.api) {
      const [alerts, faults, workOrders, serviceRequests] = await Promise.all([
        window.api.get("/alerts").catch(() => []),
        window.api.get("/faults").catch(() => []),
        window.api.get("/work-orders").catch(() => []),
        window.api.get("/service-requests").catch(() => []),
      ]);
      _alerts = Array.isArray(alerts) ? alerts : [];
      _faults = Array.isArray(faults) ? faults : [];
      _workOrders = Array.isArray(workOrders) ? workOrders : [];
      _serviceRequests = Array.isArray(serviceRequests) ? serviceRequests : [];
      return;
    }
  } catch (err) {
    console.warn("Backend fetch failed, using local data", err.message);
  }
  _workOrders = TechDB.workOrders || [];
  _serviceRequests = TechDB.serviceRequests || [];
}

/* ── STAT CARDS ─────────────────────────────────────── */
function renderStats() {
  const openAlerts = _alerts.filter((a) => a.status !== "resolved");
  const acknowledgedAlerts = openAlerts.filter(
    (a) => a.status === "acknowledged",
  );
  const openFaults = _faults.filter((f) => f.status !== "resolved");
  const pendingFaults = openFaults.filter((f) => f.status === "pending");
  const pendingWOs = _workOrders.filter((w) => w.status !== "closed");
  const highPriorityWOs = pendingWOs.filter(
    (w) => w.priority === "high" || w.priority === "immediate",
  );
  const closedWOs = _workOrders.filter((w) => w.status === "closed");

  setEl("statActiveAlerts", openAlerts.length);
  setEl("statOpenFaults", openFaults.length);
  setEl("statPendingWorkOrders", pendingWOs.length);
  setEl("statClosedWorkOrders", closedWOs.length);

  setEl(
    "noteActiveAlerts",
    `${acknowledgedAlerts.length} acknowledged, ${openAlerts.length - acknowledgedAlerts.length} unread`,
  );
  setEl("noteOpenFaults", `${pendingFaults.length} pending diagnosis`);
  setEl("notePendingWorkOrders", `${highPriorityWOs.length} high priority`);
  setEl(
    "noteClosedWorkOrders",
    `${_workOrders.length} total work order${_workOrders.length === 1 ? "" : "s"}`,
  );
}

/* ── QUICK ACTIONS ──────────────────────────────────────
 * Named items, not category counts — the sidebar already links to each
 * page, and "Work orders awaiting your review" is already covered in full
 * by the Final Verification panel above, so this only earns its place by
 * naming *which* fault, alert, or request needs attention. */
function renderQuickActions() {
  const container = document.getElementById("quickActions");
  if (!container) return;

  const severityRank = { critical: 0, high: 1, immediate: 0, moderate: 2, medium: 2, low: 3 };
  const rankOf = (v) => severityRank[v] ?? 2;

  const items = [];

  _serviceRequests
    .filter((sr) => sr.status === "open" || sr.status === "pending")
    .forEach((sr) => {
      items.push({
        rank: rankOf(sr.priority),
        color: "blue",
        title: sr.description || sr.category || "Service request",
        meta: "User-reported",
        href: "technician_work_orders.html",
      });
    });

  _faults
    .filter((f) => f.status !== "resolved")
    .forEach((f) => {
      items.push({
        rank: rankOf(f.severity),
        color: "red",
        title: f.asset_name || f.fault_type || "Fault",
        meta: `${cap(f.severity)} severity`,
        href: "technician_maintenance.html",
      });
    });

  _alerts
    .filter((a) => a.status !== "resolved")
    .forEach((a) => {
      items.push({
        rank: rankOf(a.severity),
        color: "yellow",
        title: a.title || "Alert",
        meta: `${cap(a.severity)} severity`,
        href: "technician_alerts.html",
      });
    });

  if (items.length === 0) {
    container.innerHTML =
      '<div class="empty-state">Nothing waiting on you right now — the queue is clear.</div>';
    return;
  }

  items.sort((a, b) => a.rank - b.rank);
  const shown = items.slice(0, 6);
  const remaining = items.length - shown.length;

  container.innerHTML =
    shown
      .map(
        (item) => `
      <a class="quick-action quick-action--${item.color}" href="${item.href}">
        <span class="quick-action-dot"></span>
        <span class="quick-action-label"><strong>${item.title}</strong> — ${item.meta}</span>
        <span class="quick-action-arrow">→</span>
      </a>`,
      )
      .join("") +
    (remaining > 0
      ? `<div class="quick-action-more">+${remaining} more across alerts, faults, and requests</div>`
      : "");
}

function cap(str) {
  if (!str) return "—";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function wireQueueButton() {
  document.getElementById("btnOpenQueue")?.addEventListener("click", () => {
    window.location.href = "technician_work_orders.html";
  });
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function formatID(id, prefix) {
  if (!id) return prefix + "-XXXX";
  if (id.startsWith(prefix + "-")) return id;
  const parts = id.split("-");
  if (parts.length > 1) {
    return prefix + "-" + parts[1].toUpperCase();
  }
  return prefix + "-" + id.substring(0, 4).toUpperCase();
}

/* ── FINAL VERIFICATION ─────────────────────────────── */
function renderVerifyFeed() {
  const srs = _serviceRequests;
  const wos = _workOrders;

  const pendingVerifySRs = srs.filter(
    (sr) => sr.status === "Work Complete (Awaiting Validation)",
  );
  const pendingVerifyWOs = wos.filter(
    (wo) => wo.status === "review" || wo.status === "completed",
  );
  const verifyFeed = document.getElementById("verifyFeed");

  if (!verifyFeed) return;

  if (pendingVerifySRs.length === 0 && pendingVerifyWOs.length === 0) {
    verifyFeed.innerHTML =
      '<div class="empty-state">No completed jobs awaiting verification.</div>';
    return;
  }

  let html = "";

  html += pendingVerifySRs
    .map((sr) => {
      const srId = sr.service_request_id || sr.id;
      const location = sr.location || "Unknown";
      const category = sr.category || "General";
      return `
            <div style="padding:16px;border-bottom:1px solid var(--border);">
                <h4 style="margin:0 0 4px;">${formatID(srId, "SR")} — ${location} (${category})</h4>
                <p style="margin:0 0 8px;font-size:13px;color:var(--muted);">
                    Completed by <strong>${sr.assignedTo || "Technician"}</strong>. Awaiting quality check.
                </p>
                <button class="btn btn-dark" onclick="verifyJob('${srId}')">
                    Verify &amp; Authorize Payment
                </button>
            </div>
        `;
    })
    .join("");

  html += pendingVerifyWOs
    .map((wo) => {
      const woId = wo.work_order_id || wo.id;
      return `
            <div style="padding:16px;border-bottom:1px solid var(--border);">
                <h4 style="margin:0 0 4px;">${formatID(woId, "WO")} — ${wo.title} (${wo.details?.type || "General"})</h4>
                <p style="margin:0 0 8px;font-size:13px;color:var(--muted);">
                    Completed by <strong>${wo.technician || "Technician"}</strong>. Awaiting quality check.
                </p>
                <button class="btn btn-dark" onclick="verifyWO('${woId}')">
                    Verify &amp; Close Work Order
                </button>
            </div>
        `;
    })
    .join("");

  verifyFeed.innerHTML = html;
}

window.verifyJob = async function (id) {
  try {
    if (window.api) {
      const res = await window.api.patch(`/service-requests/${id}`, {
        status: "Validated (Awaiting Payment)",
      });
      if (res && !res.error) {
        showToast(
          "Work verified. Sent to Financial Analyst for payment.",
          "success",
        );
        await loadData();
        renderVerifyFeed();
        renderStats();
        renderQuickActions();
        return;
      }
    }
  } catch (err) {
    console.warn("Backend patch failed, using local", err);
  }
  const sr = TechDB.serviceRequests.find((s) => s.id === id);
  if (sr) {
    sr.status = "Validated (Awaiting Payment)";
    TechDB.save();
    renderVerifyFeed();
    showToast(
      "Work verified. Sent to Financial Analyst for payment.",
      "success",
    );
  }
};

window.verifyWO = async function (id) {
  try {
    if (window.api && id.includes("-")) {
      // check if UUID
      const res = await window.api.patch(`/work-orders/${id}`, {
        status: "closed",
      });
      if (res && !res.error) {
        showToast("Work order verified and closed.", "success");
        await loadData();
        renderVerifyFeed();
        renderStats();
        renderQuickActions();
        return;
      }
    }
  } catch (err) {
    console.warn("Backend patch failed, using local", err);
  }
  const wo = TechDB.workOrders.find((w) => w.id === id);
  if (wo) {
    TechDB.closeWorkOrder(id);
    renderVerifyFeed();
    renderStats();
    renderQuickActions();
    showToast("Work order verified and closed.", "success");
  }
};
