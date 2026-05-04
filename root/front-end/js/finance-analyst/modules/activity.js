/**
 * activity.js
 * Activity log rendering and append helper.
 */

import FinanceDB, { persistData } from "../data/mockData.js";
import { timeAgo, generateId, openModal, showToast } from "../utils/utils.js";

const ICON_MAP = {
  report:   { icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`, cls: "i-gray"   },
  invoice:  { icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,  cls: "i-green"  },
  alert:    { icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,  cls: "i-yellow" },
  forecast: { icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,  cls: "i-gray"   },
  energy:   { icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`, cls: "i-green"  }
};

/* ── LOG ENTRY ────────────────────────────────────── */

export function logActivity(type, title, detail) {
  const entry = {
    id: generateId("act"),
    type, title, detail,
    timestamp: new Date().toISOString(),
    user: window.FinanceDB?.session?.user?.name ?? "Analyst"
  };
  FinanceDB.activityLog.unshift(entry);
  persistData();
  renderActivityList();
}

/* ── RENDER ───────────────────────────────────────── */

export function renderActivityList(limit = 8) {
  const container = document.getElementById("activity-list");
  if (!container) return;

  const now = Date.now();
  const items = FinanceDB.activityLog.slice(0, limit);

  let modified = false;
  // Dynamically rewrite old static mock dates to appear recent
  items.forEach((item, index) => {
    const timeDiff = now - new Date(item.timestamp).getTime();
    if (timeDiff > 30 * 24 * 60 * 60 * 1000) {
      // Rewrite to 1-4 hours ago
      item.timestamp = new Date(now - (index + 1) * 3600000).toISOString();
      modified = true;
    }
  });

  if (modified) persistData();

  if (items.length === 0) {
    container.innerHTML = `<p style="color:#9ca3af;font-size:14px;padding:16px 0">No recent activity.</p>`;
    return;
  }

  container.innerHTML = items.map(item => {
    const m = ICON_MAP[item.type] || ICON_MAP.report;
    return `
      <div class="activity" data-act-id="${item.id}">
        <div class="left">
          <div class="icon ${m.cls}">${m.icon}</div>
          <div>
            <div class="activity-title">${item.title}</div>
            <div class="activity-sub">${item.detail}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="time">${timeAgo(item.timestamp)}</div>
          <button
            class="action-btn btn-delete"
            style="padding:4px 10px;font-size:11px;white-space:nowrap"
            onclick="ActivityModule.deleteActivity('${item.id}')"
          >Delete</button>
        </div>
      </div>`;
  }).join("");
}

/* ── DELETE ACTIVITY ──────────────────────────────── */

export function deleteActivity(id) {
  const entry = FinanceDB.activityLog.find(e => e.id === id);
  if (!entry) return;

  openModal({
    title: "Delete Activity",
    bodyHTML: `<p>Remove <strong>"${entry.title}"</strong> from the activity log? This cannot be undone.</p>`,
    confirmLabel: "Delete",
    danger: true,
    onConfirm: () => {
      FinanceDB.activityLog = FinanceDB.activityLog.filter(e => e.id !== id);
      persistData();
      renderActivityList();
      showToast("Activity entry removed.", "success");
    }
  });
}

const ActivityModule = { logActivity, renderActivityList, deleteActivity };
window.ActivityModule = ActivityModule;
export default ActivityModule;
