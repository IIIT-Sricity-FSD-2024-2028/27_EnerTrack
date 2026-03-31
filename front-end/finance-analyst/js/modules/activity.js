/**
 * activity.js
 * Activity log rendering and append helper.
 */

import FinanceDB from "../data/mockData.js";
import { timeAgo, generateId } from "../utils/utils.js";

const ICON_MAP = {
  report:   { icon: "📄", cls: "i-gray"   },
  invoice:  { icon: "✓",  cls: "i-green"  },
  alert:    { icon: "⚠",  cls: "i-yellow" },
  forecast: { icon: "↗",  cls: "i-gray"   },
  energy:   { icon: "⚡", cls: "i-green"  }
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
  renderActivityList();
}

/* ── RENDER ───────────────────────────────────────── */

export function renderActivityList(limit = 8) {
  const container = document.getElementById("activity-list");
  if (!container) return;

  const items = FinanceDB.activityLog.slice(0, limit);

  if (items.length === 0) {
    container.innerHTML = `<p style="color:#9ca3af;font-size:14px;padding:16px 0">No recent activity.</p>`;
    return;
  }

  container.innerHTML = items.map(item => {
    const m = ICON_MAP[item.type] || ICON_MAP.report;
    return `
      <div class="activity">
        <div class="left">
          <div class="icon ${m.cls}">${m.icon}</div>
          <div>
            <div class="activity-title">${item.title}</div>
            <div class="activity-sub">${item.detail}</div>
          </div>
        </div>
        <div class="time">${timeAgo(item.timestamp)}</div>
      </div>`;
  }).join("");
}

const ActivityModule = { logActivity, renderActivityList };
window.ActivityModule = ActivityModule;
export default ActivityModule;
