/**
 * overviewPage.js
 * Handles rendering dynamic state for Sust Overview page.
 */
import SustDB from "./data/mockData.js";
import SessionModule from "./modules/session.js";
import { injectIcons } from "./utils/icons.js";

import { showToast, openModal } from "./utils/utils.js";
import {
  renderBellIcon,
  notifyOnStateChange,
} from "../shared/notifications.js";

const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

document.addEventListener("DOMContentLoaded", () => {
  SessionModule.initSession();
  injectIcons();
  renderOverview();
  renderWastageAuditQueue();

  // Render notification bell
  renderBellIcon("notif-container", currentUser.email);

  // Auto-refresh queue if another tab (Campus Visitor) submits a report
  window.addEventListener("storage", (e) => {
    if (e.key === "enertrack_universal_v1") {
      renderWastageAuditQueue();
    }
    if (e.key && e.key.indexOf("enertrack_notifications_") === 0) {
      renderBellIcon("notif-container", currentUser.email);
    }
  });
});

async function renderOverview() {
  // Fetch sustainability metrics from backend
  try {
    const [metricsRes, initsRes] = await Promise.all([
      window.api.get("/sustainability-metrics"),
      window.api.get("/initiatives"),
    ]);

    if (metricsRes.success && metricsRes.data.length > 0) {
      // Use the latest period record
      const latest = metricsRes.data[metricsRes.data.length - 1];
      setText("val-energy", latest.energy_consumed, " <small>GWh</small>");
      setText("val-water", latest.water_usage, " <small>ML</small>");
      setText("val-emissions", latest.emissions, " <small>tCO₂e</small>");
    } else {
      // Fallback to SustDB values
      setText(
        "val-energy",
        SustDB.metrics.energyConsumed,
        " <small>GWh</small>",
      );
      setText("val-water", SustDB.metrics.waterUsage, " <small>ML</small>");
      setText(
        "val-emissions",
        SustDB.metrics.emissions,
        " <small>tCO₂e</small>",
      );
    }

    if (initsRes.success) {
      const activeCount = initsRes.data.filter(
        (i) => i.status !== "completed",
      ).length;
      setText("val-initiatives", activeCount);
    } else {
      const activeInitsCount = SustDB.initiatives.filter(
        (i) => i.status !== "completed",
      ).length;
      setText("val-initiatives", activeInitsCount);
    }
  } catch (err) {
    console.warn(
      "[SO Overview] Backend unavailable, using SustDB fallback:",
      err.message,
    );
    setText("val-energy", SustDB.metrics.energyConsumed, " <small>GWh</small>");
    setText("val-water", SustDB.metrics.waterUsage, " <small>ML</small>");
    setText("val-emissions", SustDB.metrics.emissions, " <small>tCO₂e</small>");
    const activeInitsCount = SustDB.initiatives.filter(
      (i) => i.status !== "completed",
    ).length;
    setText("val-initiatives", activeInitsCount);
  }

  // Quick Stats remain from SustDB (no backend entity for these yet)
  setText("stat-sites", SustDB.metrics.reportingSites);
  setText("stat-alerts", SustDB.metrics.alertsResolved);
  setText("stat-progress", SustDB.metrics.reductionProgress + "%");
  setText("stat-review", SustDB.metrics.nextReviewDays + " days");
}

/* ── Period Selector for Overview Chart ───────────── */

function wirePeriodSelector() {
  const selector = document.getElementById("overviewPeriodSelector");
  if (!selector) return;

  selector.querySelectorAll(".pill-item").forEach((pill) => {
    pill.addEventListener("click", () => {
      // Toggle active styles
      selector.querySelectorAll(".pill-item").forEach((p) => {
        p.style.background = "#f3f4f6";
        p.style.color = "#6b7280";
        p.style.fontWeight = "500";
        p.classList.remove("active");
      });
      pill.style.background = "#e6f4ec";
      pill.style.color = "#0f9f6f";
      pill.style.fontWeight = "600";
      pill.classList.add("active");

      updateOverviewChart(pill.dataset.period);
    });
  });
}

function updateOverviewChart(period) {
  const history = SustDB.data?.monitoring?.history?.[period];
  if (!history) return;

  const chartContainer = document.querySelector(".chart-container");
  const labelContainer = document.querySelector(".chart-labels");
  if (!chartContainer || !labelContainer) return;

  // Build bar groups dynamically
  const maxE = Math.max(...history.e);
  const maxW = Math.max(...history.w);
  const maxM = Math.max(...history.m);
  const foodSeries =
    Array.isArray(history.f) && history.f.length === history.e.length
      ? history.f
      : history.e.map((v) => Math.round(v * 0.62));
  const maxF = Math.max(...foodSeries);
  const globalMax = Math.max(maxE, maxW, maxM, maxF) || 1;

  let groupsHTML = "";
  for (let i = 0; i < history.e.length; i++) {
    const eH = Math.round((history.e[i] / globalMax) * 90);
    const wH = Math.round((history.w[i] / globalMax) * 90);
    const mH = Math.round((history.m[i] / globalMax) * 90);
    const fH = Math.round((foodSeries[i] / globalMax) * 90);
    groupsHTML += `
            <div class="chart-group">
                <div class="bar energy" style="height: ${eH}%;"></div>
                <div class="bar water" style="height: ${wH}%;"></div>
                <div class="bar emissions" style="height: ${mH}%;"></div>
                <div class="bar food" style="height: ${fH}%;"></div>
            </div>`;
  }
  chartContainer.innerHTML = groupsHTML;

  // Update labels
  labelContainer.innerHTML = history.labels
    .map((l) => `<span>${l}</span>`)
    .join("");
}

/* ── Dynamic Recent Highlights ───────────────────── */

function renderRecentHighlights() {
  const container = document.getElementById("global-highlights-list");
  if (!container) return;

  // Must reload latest highlights directly internally
  // const highlights = SustDB.data.highlights || [];
  const highlights = SustDB?.data?.highlights || [];
  if (highlights.length === 0) {
    container.innerHTML = `<div class="highlight-item"><p style="color:#6b7280; font-size: 14px; margin: 0;">No recent highlights to show.</p></div>`;
    return;
  }

  // Take the most recent 5
  const recent = highlights.slice(0, 5);

  container.innerHTML = recent
    .map((h, index) => {
      // Simple color mappings
      const colorHex =
        h.color === "green"
          ? "#10b981"
          : h.color === "yellow"
            ? "#f59e0b"
            : h.color === "gray"
              ? "#6b7280"
              : "#3b82f6";

      // Relative time formatting
      const timeStr = new Date(h.time).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      return `
            <div class="highlight-item" style="display:flex; flex-direction:column; gap: 8px; margin-bottom: 12px; border: none; padding: 0;">
                <div style="display:flex; gap: 12px; align-items:flex-start; width: 100%;">
                    <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${colorHex}; margin-top: 6px; flex-shrink: 0;"></div>
                    <div style="flex-grow: 1;">
                        <h4 style="margin-bottom: 4px; font-size: 14px; font-weight: 600; color: #111827; display: flex; justify-content: space-between; align-items: center;">
                            ${h.title} <span style="font-weight: 400; color: #9ca3af; font-size: 12px; margin-left: 12px;">${timeStr}</span>
                        </h4>
                        <p style="margin: 0; font-size: 13px; color: #4b5563;">${h.desc}</p>
                        
                        <div style="margin-top: 4px;">
                            <button class="btn-mark-read" data-index="${index}">
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                                Mark as read
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    })
    .join("");

  container.querySelectorAll(".btn-mark-read").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const indexStr = e.currentTarget.dataset.index;
      if (indexStr !== undefined) {
        const idx = parseInt(indexStr, 10);
        SustDB.removeHighlightIndex(idx);
        renderRecentHighlights();
      }
    });
  });
}

function setText(id, value, fallbackSuffix = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = value + fallbackSuffix;
}

/* ── Wastage Audit Queue (Steps 6-8) ──────────────── */

async function renderWastageAuditQueue() {
  const container = document.getElementById("wastageAuditContainer");
  const countBadge = document.getElementById("wastageQueueCount");
  const section = document.getElementById("wastageAuditSection");
  if (!container) return;

  let reports = [];

  // Try backend first
  try {
    if (window.api) {
      const res = await window.api.get("/wastage-reports");
      if (Array.isArray(res)) {
        reports = res.map((r) => {
          const details = r.details || {};
          // Capitalize status if needed (backend might use lowercase 'reported')
          let capStatus = r.status
            ? r.status.charAt(0).toUpperCase() + r.status.slice(1)
            : "Reported";
          if (capStatus === "Target set") capStatus = "Target Set";
          if (capStatus === "Cost impact added")
            capStatus = "Cost Impact Added";

          let rawType = r.type || r.category || "energy";
          let capType = rawType.charAt(0).toUpperCase() + rawType.slice(1);

          return {
            id: r.wastage_report_id || r.id,
            type: capType,
            timestamp:
              r.created_at || details.timestamp || new Date().toISOString(),
            status: capStatus,
            specificData: details.specificData || details || {},
            systemData: details.systemData || {},
            priority: details.priority || "Medium",
            reporterName: r.reporter_id || "Unknown User", // we might not have names
            ...r,
            status: capStatus,
            details: details,
          };
        });
        console.log(
          "[SO Wastage] Loaded",
          reports.length,
          "reports from backend",
        );
      }
    }
  } catch (err) {
    console.warn(
      "[SO Wastage] Backend fetch failed, using local data",
      err.message,
    );
  }

  const raw = localStorage.getItem("enertrack_universal_v1");
  const universalData = raw ? JSON.parse(raw) : null;

  // Fallback to local
  if (
    !reports.length &&
    universalData &&
    universalData.workflow &&
    universalData.workflow.wastageReports
  ) {
    reports = universalData.workflow.wastageReports;
  }

  // Auto-archive delivered and legacy dismissed reports that weren't already marked
  let needsSave = false;
  for (let r of reports) {
    if (r.status === "Delivered" && !r.details?.soArchived) {
      r.details = r.details || {};
      r.details.soArchived = true;
      r.details.soArchivedAt =
        r.details.deliveredAt || new Date().toISOString();
      needsSave = true;
    }
    if (r.status === "Dismissed" && !r.details?.archived) {
      r.details = r.details || {};
      r.details.archived = true;
      r.details.archivedAt = r.details.dismissedAt || new Date().toISOString();
      needsSave = true;
    }
  }
  // We don't auto-patch backend for this minor state, relying on the fact that these are read-only views now

  const activeReports = reports.filter((r) => !r.details?.soArchived);

  const pendingReports = activeReports.filter(
    (r) => r.status === "Reported" || r.status === "Validated",
  );
  const allActionable = activeReports.filter((r) => r.status !== "Dismissed");

  if (countBadge) countBadge.textContent = `${pendingReports.length} pending`;

  if (allActionable.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:32px;color:#9ca3af;font-size:14px;border:2px dashed #e5e7eb;border-radius:10px;">No wastage reports have been submitted yet.</div>`;
    return;
  }

  const TYPE_COLORS = {
    Energy: "#f59e0b",
    Water: "#3b82f6",
    Emissions: "#8b5cf6",
    Food: "#ef4444",
  };
  const TYPE_ICONS = {
    Energy:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    Water:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
    Emissions:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 18l4-8 4 8"/><path d="M3 20h18"/><path d="M12 2v4"/></svg>',
    Food: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
  };

  container.innerHTML = allActionable
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map((r) => {
      const color = TYPE_COLORS[r.type] || "#6b7280";
      const icon = TYPE_ICONS[r.type] || "";
      const sd = r.systemData || {};
      const spec = r.specificData || {};

      // Derive user observation summary
      let userSummary = "";
      let userLocation = "";
      if (r.type === "Energy") {
        userSummary = spec.observation || "—";
        userLocation = spec.building || "—";
      } else if (r.type === "Water") {
        userSummary = spec.nature || "—";
        userLocation = spec.location || "—";
      } else if (r.type === "Emissions") {
        userSummary = spec.observation || "—";
        userLocation = spec.location || "—";
      } else if (r.type === "Food") {
        userSummary = `${spec.typeOfWastage || "—"} (~${spec.estimatedAmount || "?"}kg)`;
        userLocation = spec.cafeteria || "—";
      }

      // Status styling
      let statusBg = "#fef3c7";
      let statusColor = "#92400e";
      let statusLabel = r.status;
      if (r.status === "Validated") {
        statusBg = "#dcfce7";
        statusColor = "#166534";
      } else if (r.status === "Forwarded to Finance") {
        statusBg = "#dbeafe";
        statusColor = "#1e40af";
      } else if (r.status === "Cost Impact Added") {
        statusBg = "#e0e7ff";
        statusColor = "#3730a3";
        statusLabel = "Cost Impact Added (at Finance)";
      } else if (r.status === "Returned to SO") {
        statusBg = "#fef3c7";
        statusColor = "#92400e";
        statusLabel = "Returned with Cost Data";
      } else if (r.status === "Finalized") {
        statusBg = "#d1fae5";
        statusColor = "#065f46";
      } else if (r.status === "Target Set") {
        statusBg = "#dbeafe";
        statusColor = "#1e40af";
        statusLabel = "✓ Target Set";
      } else if (r.status === "Dismissed") {
        statusBg = "#fee2e2";
        statusColor = "#991b1b";
      } else if (r.status === "Delivered") {
        statusBg = "#d1fae5";
        statusColor = "#065f46";
        statusLabel = "Delivered to Campus Visitor";
      }

      // Cost impact display (from Finance Analyst — Steps 13)
      let costImpactHTML = "";
      if (
        r.costImpact &&
        (r.status === "Returned to SO" ||
          r.status === "Finalized" ||
          r.status === "Target Set" ||
          r.status === "Delivered")
      ) {
        const ci = r.costImpact;
        const formatCurr = (v) => "₹" + Number(v).toLocaleString("en-IN");

        // Green box when target is set or finalized; orange when still pending action
        const isTargetDone =
          r.status === "Target Set" ||
          r.status === "Finalized" ||
          r.status === "Delivered";
        const boxBg = isTargetDone ? "#f0fdf4" : "#fffbeb";
        const boxBorder = isTargetDone ? "#bbf7d0" : "#fde68a";
        const headColor = isTargetDone ? "#065f46" : "#92400e";
        const headIcon = isTargetDone ? "✅" : "💰";
        const headLabel = isTargetDone
          ? "Finance Assessment — Resolved"
          : "Finance Cost Impact Assessment";

        // Embedded target section (only when target is set)
        let embeddedTargetHTML = "";
        if (r.metricTarget && isTargetDone) {
          const mt = r.metricTarget;
          embeddedTargetHTML = `
                <div style="margin-top:14px;padding-top:14px;border-top:1px dashed ${boxBorder};">
                    <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#1e40af;margin:0 0 8px 0;">🎯 New Metric Target</h4>
                    <div style="display:flex;gap:20px;align-items:center;">
                        <div>
                            <div style="font-size:11px;color:#6b7280;">Target Value</div>
                            <div style="font-size:18px;font-weight:700;color:#1e40af;">${mt.value} <small>${mt.unit}</small></div>
                        </div>
                        <div>
                            <div style="font-size:11px;color:#6b7280;">Deadline</div>
                            <div style="font-size:14px;font-weight:600;color:#374151;">${new Date(mt.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                        </div>
                    </div>
                    ${mt.justification ? `<div style="margin-top:6px;font-size:12px;color:#6b7280;">"${mt.justification}"</div>` : ""}
                    <div style="margin-top:4px;font-size:11px;color:#9ca3af;">Set at ${mt.setAt ? new Date(mt.setAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                </div>`;
        }

        costImpactHTML = `
            <div style="background:${boxBg};border:1px solid ${boxBorder};border-radius:8px;padding:14px;margin-bottom:14px;">
                <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:${headColor};margin:0 0 10px 0;">${headIcon} ${headLabel}</h4>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                    <div>
                        <div style="font-size:11px;color:#6b7280;">Est. Financial Loss</div>
                        <div style="font-size:16px;font-weight:700;color:#dc2626;">${formatCurr(ci.estimatedLoss)}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#6b7280;">Remediation Cost</div>
                        <div style="font-size:16px;font-weight:700;color:#111827;">${formatCurr(ci.remediationCost)}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#6b7280;">Projected Savings</div>
                        <div style="font-size:16px;font-weight:700;color:#059669;">${formatCurr(ci.projectedSavings)}</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;padding-top:10px;border-top:1px dashed ${boxBorder};">
                    <div>
                        <div style="font-size:11px;color:#6b7280;">ROI</div>
                        <div style="font-size:16px;font-weight:700;color:${ci.roi != null && ci.roi >= 0 ? "#059669" : "#dc2626"};">${ci.roi != null ? ci.roi.toFixed(1) + "%" : ci.projectedSavings && ci.remediationCost ? (((ci.projectedSavings - ci.remediationCost) / ci.remediationCost) * 100).toFixed(1) + "%" : "\u2014"}</div>
                    </div>
                    <div>
                        <div style="font-size:11px;color:#6b7280;">Payback Period</div>
                        <div style="font-size:16px;font-weight:700;color:#1e40af;">${ci.paybackPeriod != null ? ci.paybackPeriod.toFixed(1) + " yrs" : ci.projectedSavings > 0 ? (ci.remediationCost / ci.projectedSavings).toFixed(1) + " yrs" : "\u2014"}</div>
                    </div>
                </div>
                ${ci.notes ? `<div style="margin-top:8px;font-size:12px;color:#6b7280;font-style:italic;">"${ci.notes}"</div>` : ""}
                <div style="margin-top:6px;font-size:11px;color:#9ca3af;">Added by ${ci.addedBy || "Finance"} • ${ci.addedAt ? new Date(ci.addedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</div>
                ${embeddedTargetHTML}
            </div>`;
      }

      // Standalone target display is no longer needed — target is now embedded in cost-impact box
      let targetHTML = "";

      // Action buttons (only for actionable statuses)
      let actionsHTML = "";
      if (r.status === "Reported") {
        actionsHTML = `
                <button onclick="window._auditAction('${r.id}','validate')" style="padding:6px 14px;border-radius:6px;border:none;background:#059669;color:white;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">✓ Validate</button>
                <button onclick="window._auditAction('${r.id}','dismiss')" style="padding:6px 14px;border-radius:6px;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;font-size:12px;font-weight:700;cursor:pointer;transition:opacity .2s;">✗ Dismiss</button>`;
      } else if (r.status === "Validated") {
        actionsHTML = `
                <button onclick="window._auditAction('${r.id}','forward')" style="padding:6px 14px;border-radius:6px;border:none;background:#3b82f6;color:white;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">→ Forward to Finance</button>`;
      } else if (r.status === "Returned to SO") {
        actionsHTML = `
                <button onclick="window._openTargetModal('${r.id}')" style="padding:8px 16px;border-radius:6px;border:none;background:#2563eb;color:white;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">Set New Target</button>
                <button onclick="window._sendBackToFinance('${r.id}')" style="padding:8px 16px;border-radius:6px;border:1px solid #d1d5db;background:white;color:#6b7280;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">↻ Send Back to Finance</button>`;
      } else if (r.status === "Target Set") {
        actionsHTML = `
                <button onclick="window._finalizeReport('${r.id}')" style="padding:8px 16px;border-radius:6px;border:none;background:#111827;color:white;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">✓ Finalize Report</button>
                <button onclick="window._openTargetModal('${r.id}')" style="padding:8px 16px;border-radius:6px;border:1px solid #d1d5db;background:white;color:#374151;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">Edit Target</button>`;
      } else if (r.status === "Finalized") {
        actionsHTML = `
                <button onclick="window._sendReportToUser('${r.id}')" style="padding:8px 16px;border-radius:6px;border:none;background:#059669;color:white;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s;">Send Detailed Report to Campus Visitor</button>`;
      }

      const anomalyTag = sd.anomalyDetected
        ? `<span style="background:#fef2f2;color:#991b1b;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">⚠ Anomaly Detected</span>`
        : `<span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Normal Range</span>`;
      const reportedValueLabel = spec.reportedValue
        ? `${spec.reportedValue} ${spec.reportedUnit || ""}`.trim()
        : "Not provided";

      // Format UUIDs for display
      const shortId = r.id
        ? r.id.includes("-")
          ? r.id.split("-")[0].toUpperCase()
          : r.id.substring(0, 8).toUpperCase()
        : "UNK";
      let reporterDisplay = r.reporterName || "Campus Visitor";
      if (reporterDisplay.includes("-")) {
        reporterDisplay = "Campus Visitor";
      }

      return `
        <div style="background:#fdfdfd;border:1px solid #e5e7eb;border-left:4px solid ${color};border-radius:10px;padding:20px;margin-bottom:14px;transition:box-shadow .2s;" onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.06)'" onmouseout="this.style.boxShadow='none'">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="color:${color}">${icon}</span>
                    <strong style="font-size:14px;color:#111827;" title="${r.id}">#WR-${shortId}</strong>
                    <span style="background:${color};color:white;padding:2px 8px;border-radius:4px;font-size:11px;">${r.type} Wastage</span>
                    <span style="font-size:12px;color:#9ca3af;" title="${r.reporterName}">by ${reporterDisplay}</span>
                </div>
                <span style="background:${statusBg};color:${statusColor};padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;">${statusLabel}</span>
            </div>

            ${costImpactHTML}
            ${targetHTML}

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:14px;">
                <!-- User Observation -->
                <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;">
                    <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;margin:0 0 10px 0;">User Observation</h4>
                    <p style="font-size:13px;color:#374151;margin:0 0 6px 0;line-height:1.5;">${userSummary}</p>
                    <div style="font-size:12px;color:#6b7280;display:flex;align-items:center;gap:4px;">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        ${userLocation}
                    </div>
                    <div style="margin-top:6px;">
                        <span style="font-size:11px;padding:2px 6px;border-radius:4px;font-weight:600;background:${r.priority === "High" ? "#fef2f2;color:#991b1b" : r.priority === "Medium" ? "#fffbeb;color:#92400e" : "#f0fdf4;color:#166534"}">${r.priority} Priority</span>
                    </div>
                </div>

                <!-- System Sensor Data -->
                <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px;">
                    <h4 style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#0369a1;margin:0 0 10px 0;">${r.type === "Food" ? "Wastage Assessment" : r.type === "Water" ? "Flow Monitoring" : r.type === "Emissions" ? "Emissions Monitoring" : "Energy Meter Reading"} (${sd.sensorId || "—"})</h4>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                        <div>
                            <div style="font-size:11px;color:#6b7280;">Current</div>
                            <div style="font-size:18px;font-weight:700;color:#111827;">${sd.readingValue || "—"} <small style="font-size:12px;">${sd.readingUnit || ""}</small></div>
                        </div>
                        <div>
                            <div style="font-size:11px;color:#6b7280;">Baseline</div>
                            <div style="font-size:18px;font-weight:700;color:#6b7280;">${sd.baselineValue || "—"} <small style="font-size:12px;">${sd.readingUnit || ""}</small></div>
                        </div>
                    </div>
                    <div style="margin-top:8px;display:flex;align-items:center;gap:8px;">
                        ${anomalyTag}
                        <span style="font-size:11px;color:#6b7280;">Confidence: ${sd.confidence ? (sd.confidence * 100).toFixed(0) + "%" : "—"}</span>
                    </div>
                    <div style="margin-top:6px;font-size:11px;color:#0f766e;background:#ecfeff;border:1px solid #a5f3fc;border-radius:6px;padding:6px 8px;">
                        End-user provided estimate: <strong>${reportedValueLabel}</strong> (${sd.source === "user-reported" ? "used in assessment" : "no value provided, simulated baseline used"})
                    </div>
                    <div style="margin-top:4px;font-size:11px;color:#9ca3af;">${sd.deviation ? sd.deviation + "% above baseline" : ""}</div>
                </div>
            </div>

            <!-- Comment Thread -->
            ${(() => {
              const comments = r.comments || [];
              const commentListHTML = comments
                .map((c) => {
                  const roleBadge =
                    c.role === "Sustainability Officer"
                      ? "SO"
                      : c.role === "Finance Analyst"
                        ? "FA"
                        : "CV";
                  const roleBg =
                    c.role === "Sustainability Officer"
                      ? "#059669"
                      : c.role === "Finance Analyst"
                        ? "#6366f1"
                        : "#6b7280";
                  return `<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #f3f4f6;">
                        <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:${roleBg};color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">${roleBadge}</div>
                        <div style="flex:1;min-width:0;">
                            <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:12px;font-weight:600;color:#111827;">${c.author}</span><span style="font-size:10px;color:#9ca3af;">${new Date(c.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>
                            <p style="font-size:12px;color:#374151;margin:2px 0 0 0;line-height:1.5;">${c.text}</p>
                        </div>
                    </div>`;
                })
                .join("");
              return `
                <div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:10px;margin-bottom:14px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;" onclick="const el=this.nextElementSibling;el.style.display=el.style.display==='none'?'block':'none';this.querySelector('.cmt-toggle').textContent=el.style.display==='none'?'Show':'Hide';">
                        <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#6b7280;font-weight:600;">Comments (${comments.length})</span>
                        <span class="cmt-toggle" style="font-size:11px;color:#059669;font-weight:600;">Show</span>
                    </div>
                    <div style="display:none;">
                        ${commentListHTML || '<p style="font-size:12px;color:#9ca3af;margin:8px 0;">No comments yet.</p>'}
                        <div style="display:flex;gap:8px;margin-top:8px;">
                            <input type="text" id="so-cmt-${r.id}" placeholder="Add a comment..." style="flex:1;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;color:#1f2937;">
                            <button onclick="window._addSOComment('${r.id}')" style="padding:6px 12px;border-radius:6px;border:none;background:#111827;color:white;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">Send</button>
                        </div>
                    </div>
                </div>`;
            })()}

            <div style="display:flex;gap:8px;align-items:center;border-top:1px solid #f3f4f6;padding-top:12px;">
                ${actionsHTML}
                <span style="margin-left:auto;font-size:11px;color:#9ca3af;">${new Date(r.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
        </div>`;
    })
    .join("");
}

async function _updateWastageReport(id, patchData) {
  try {
    if (window.api) {
      const all = await window.api.get("/wastage-reports");
      const target = all.find((r) => r.wastage_report_id === id);
      if (target) {
        const payload = {
          status: patchData.status || target.status,
          details: { ...(target.details || {}), ...(patchData.details || {}) },
        };
        await window.api.patch(`/wastage-reports/${id}`, payload);
        return true;
      }
    }
  } catch (e) {
    console.error("Failed to update via API", e);
  }

  // Fallback
  const raw = localStorage.getItem("enertrack_universal_v1");
  if (!raw) return false;
  const data = JSON.parse(raw);
  const target = (data.workflow.wastageReports || []).find((r) => r.id === id);
  if (target) {
    Object.assign(target, patchData);
    if (patchData.details) Object.assign(target, patchData.details);
    localStorage.setItem("enertrack_universal_v1", JSON.stringify(data));
    return true;
  }
  return false;
}

// SO Comment Handler
window._addSOComment = async function (reportId) {
  const input = document.getElementById(`so-cmt-${reportId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  let reports = [];
  if (window.api) {
    reports = await window.api.get("/wastage-reports");
  }
  const report = reports.find((r) => r.wastage_report_id === reportId) || {};
  const comments = report.details?.comments || [];

  comments.push({
    author: currentUser.name || "Sustainability Officer",
    role: "Sustainability Officer",
    text: text,
    timestamp: new Date().toISOString(),
  });

  await _updateWastageReport(reportId, { details: { comments } });
  await renderWastageAuditQueue();
};

// Global action handler for audit buttons
// window._auditAction = function (reportId, action) {
//     if (action === 'validate') {
//         SustDB.updateWastageReport(reportId, { status: 'Validated', validatedAt: new Date().toISOString() });
//         SustDB.addHighlight('Wastage Report Validated', `Report #${reportId} confirmed by Sustainability Officer.`, 'green');
//         showToast('Report validated successfully.', 'success', 2000);
//     } else if (action === 'dismiss') {
//         SustDB.updateWastageReport(reportId, { status: 'Dismissed', dismissedAt: new Date().toISOString() });
//         SustDB.addHighlight('Wastage Report Dismissed', `Report #${reportId} dismissed as false alarm.`, 'gray');
//         showToast('Report dismissed.', 'info', 2000);
//     } else if (action === 'forward') {
//         SustDB.updateWastageReport(reportId, { status: 'Forwarded to Finance', forwardedAt: new Date().toISOString() });
//         SustDB.addHighlight('Report Forwarded to Finance', `Report #${reportId} sent for cost impact analysis.`, 'blue');
//         showToast('Report forwarded to Finance Analyst.', 'success', 2000);
//     }
//     renderWastageAuditQueue();
//     renderRecentHighlights();
// };

window._auditAction = async function (reportId, action) {
  if (action === "validate") {
    await _updateWastageReport(reportId, {
      status: "Validated",
      details: { validatedAt: new Date().toISOString() },
    });
    showToast("Report validated successfully.", "success", 2000);
    notifyOnStateChange(
      { id: reportId },
      "validated",
      currentUser.name || "Sustainability Officer",
    );
    renderBellIcon("notif-container", currentUser.email);
    await renderWastageAuditQueue();
    renderRecentHighlights();
  } else if (action === "dismiss") {
    openModal({
      title: "Dismiss Report With Reason",
      bodyHTML: `
                <div style="margin-bottom:12px;background:linear-gradient(135deg,#fff1f2,#ffe4e6);border:1px solid #fecdd3;border-radius:12px;padding:12px 14px;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <span style="display:inline-flex;width:20px;height:20px;align-items:center;justify-content:center;border-radius:999px;background:#ef4444;color:white;font-size:12px;font-weight:700;">!</span>
                        <strong style="font-size:13px;color:#9f1239;">Dismissal Confirmation</strong>
                    </div>
                    <div style="font-size:13px;color:#6b7280;line-height:1.5;">This will close <strong>Report #${reportId}</strong>, notify the end user, and move it to archives.</div>
                </div>
                <div style="display:grid;grid-template-columns:1fr;gap:12px;">
                    <div>
                        <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;">Reason *</label>
                        <select id="dismiss-reason" style="width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;color:#1f2937;background:#fff;">
                        <option value="">Select a reason...</option>
                        <option value="False Alarm">False Alarm</option>
                        <option value="Insufficient Evidence">Insufficient Evidence</option>
                        <option value="Already Addressed">Already Addressed</option>
                        <option value="Out of Scope">Out of Scope</option>
                        <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:6px;">Explanation *</label>
                        <textarea id="dismiss-comment" rows="4" style="width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;color:#1f2937;resize:vertical;font-family:inherit;" placeholder="Provide clear details (minimum 10 characters)..."></textarea>
                        <div style="font-size:11px;color:#9ca3af;margin-top:6px;">This explanation is shown to the end user in their dismissal notice.</div>
                    </div>
                </div>
            `,
      confirmLabel: "Confirm Dismissal",
      cancelLabel: "Cancel",
      danger: true,
      onConfirm: async () => {
        const reason = document.getElementById("dismiss-reason")?.value;
        const comment = document
          .getElementById("dismiss-comment")
          ?.value?.trim();
        if (!reason) {
          showToast("Please select a reason for dismissal.", "warning");
          return false;
        }
        if (!comment || comment.length < 10) {
          showToast("Explanation must be at least 10 characters.", "warning");
          return false;
        }

        const newComment = {
          author: currentUser.name || "Sustainability Officer",
          role: "Sustainability Officer",
          text: `Dismissed this report. Reason: ${reason}. ${comment}`,
          timestamp: new Date().toISOString(),
        };

        // Get existing comments first to append
        let comments = [];
        if (window.api) {
          const all = await window.api.get("/wastage-reports");
          const rep = all.find((r) => r.wastage_report_id === reportId);
          if (rep && rep.details?.comments) comments = rep.details.comments;
        }
        comments.push(newComment);

        await _updateWastageReport(reportId, {
          status: "Dismissed",
          details: {
            dismissedAt: new Date().toISOString(),
            dismissReason: reason,
            dismissComment: comment,
            archived: true,
            archivedAt: new Date().toISOString(),
            comments,
          },
        });

        showToast("Report dismissed with reason.", "info", 2000);
        notifyOnStateChange(
          { id: reportId },
          "dismissed",
          currentUser.name || "Sustainability Officer",
        );
        renderBellIcon("notif-container", currentUser.email);
        await renderWastageAuditQueue();
        renderRecentHighlights();
        return true;
      },
    });
    return;
  } else if (action === "forward") {
    await _updateWastageReport(reportId, {
      status: "Forwarded to Finance",
      details: { forwardedAt: new Date().toISOString() },
    });
    showToast("Report forwarded to Finance Analyst.", "success", 2000);
    notifyOnStateChange(
      { id: reportId },
      "forwarded",
      currentUser.name || "Sustainability Officer",
    );
    renderBellIcon("notif-container", currentUser.email);
    await renderWastageAuditQueue();
    renderRecentHighlights();
  }
};

/* ══════════════════════════════════════════════════════
   Steps 13-15: SO Finalization & Target Setting
   ══════════════════════════════════════════════════════ */

/* ── Step 14: Finalize Report ─────────────────────── */

window._finalizeReport = async function (reportId) {
  await _updateWastageReport(reportId, {
    status: "Finalized",
    details: {
      finalizedAt: new Date().toISOString(),
      finalizedBy: "Sustainability Officer",
    },
  });

  SustDB.addHighlight(
    "Wastage Report Finalized",
    `Report #${reportId} finalized with Finance cost-impact data.`,
    "green",
  );

  showToast("Report finalized and archived.", "success", 2500);
  await renderWastageAuditQueue();
  renderRecentHighlights();
};

/* ── Send Back to Finance (with revision notes form) ─ */

window._sendBackToFinance = function (reportId) {
  const bodyHTML = `
        <div style="margin-bottom:6px;font-size:13px;color:#6b7280;">Explain what changes are needed for report <strong>#${reportId}</strong>:</div>
        <div style="margin-bottom:12px;">
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">What needs to be revised? *</label>
            <textarea id="sb-reason" rows="3" placeholder="e.g. The remediation cost seems too high, please re-assess..." style="width:100%;padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;resize:vertical;font-family:inherit;box-sizing:border-box;"></textarea>
        </div>
        <div>
            <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Additional notes (optional)</label>
            <input type="text" id="sb-notes" placeholder="Any extra context..." style="width:100%;padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;">
        </div>
    `;

  openModal({
    title: "↻ Send Back to Finance Analyst",
    bodyHTML,
    confirmLabel: "Send Back",
    cancelLabel: "Cancel",
    onConfirm: async () => {
      const reason = document.getElementById("sb-reason")?.value?.trim();
      const notes = document.getElementById("sb-notes")?.value?.trim();

      if (!reason) {
        showToast("Please explain what changes are needed.", "warning");
        return false;
      }

      const revisionRequest = {
        reason: reason,
        notes: notes || "",
        requestedAt: new Date().toISOString(),
        requestedBy: "Sustainability Officer",
      };

      await _updateWastageReport(reportId, {
        status: "Forwarded to Finance",
        details: {
          costImpact: null, // Clear cost impact
          returnedAt: null,
          sentBackAt: new Date().toISOString(),
          revisionRequest,
        },
      });

      SustDB.addHighlight(
        "Report Sent Back to Finance",
        `Report #${reportId} sent back for revision: "${reason.substring(0, 60)}${reason.length > 60 ? "..." : ""}"`,
        "yellow",
      );

      showToast("Report sent back to Finance for revision.", "warning", 2500);
      await renderWastageAuditQueue();
      renderRecentHighlights();
    },
  });
};

/* ── Send Detailed Report to End User ─────────────── */

window._sendReportToUser = async function (reportId) {
  await _updateWastageReport(reportId, {
    status: "Delivered",
    details: {
      deliveredAt: new Date().toISOString(),
      deliveredBy: "Sustainability Officer",
      soArchived: true,
      soArchivedAt: new Date().toISOString(),
    },
  });

  SustDB.addHighlight(
    "Report Delivered to Campus Visitor",
    `Full report for #${reportId} sent.`,
    "green",
  );

  showToast("Detailed report delivered to the end user.", "success", 2500);
  notifyOnStateChange({ id: reportId }, "delivered", "Sustainability Officer");
  renderBellIcon("notif-container", currentUser.email);
  await renderWastageAuditQueue();
  renderRecentHighlights();
};

/* ── Step 15: Set New Metric Target ───────────────── */

const METRIC_UNITS = {
  Energy: "kWh",
  Water: "L",
  Emissions: "kg CO2e",
  Food: "kg",
};
const METRIC_FIELDS = {
  Energy: "energyConsumed",
  Water: "waterUsage",
  Emissions: "emissions",
  Food: null,
};

window._openTargetModal = async function (reportId) {
  // Fetch report from backend API first, then fall back to localStorage
  let report = null;
  let universalData = {};

  try {
    if (window.api) {
      const allReports = await window.api.get("/wastage-reports");
      if (Array.isArray(allReports)) {
        const backendReport = allReports.find(r => r.wastage_report_id === reportId);
        if (backendReport) {
          report = {
            id: backendReport.wastage_report_id,
            type: backendReport.type,
            status: backendReport.status,
            specificData: backendReport.details?.specificData || {},
            systemData: backendReport.details?.systemData || {},
            metricTarget: backendReport.details?.metricTarget || null,
            costImpact: backendReport.details?.costImpact || null,
          };
        }
      }
    }
  } catch (e) {
    console.warn("[SO] Failed to fetch from backend for target modal", e);
  }

  // Fallback to localStorage
  if (!report) {
    const raw = localStorage.getItem("enertrack_universal_v1");
    if (!raw) return;
    universalData = JSON.parse(raw);
    const reports = universalData.workflow?.wastageReports || [];
    report = reports.find((r) => r.id === reportId);
  }

  if (!report) {
    console.warn("[SO] Report not found for target modal:", reportId);
    return;
  }

  const metricType = report.type || "Energy";
  const unit =
    report?.systemData?.readingUnit || METRIC_UNITS[metricType] || "units";
  const metricField = METRIC_FIELDS[metricType];
  const currentValue = Number.isFinite(Number(report?.systemData?.readingValue))
    ? Number(report.systemData.readingValue)
    : metricField
      ? universalData.sust?.metrics?.[metricField] || "—"
      : "—";
  const existing = report.metricTarget || {};
  const currentMeasured = Number(report?.systemData?.readingValue);
  const currentBaseline = Number(report?.systemData?.baselineValue);
  const userProvided = Number(report?.specificData?.reportedValue);
  const suggestedTarget =
    Number.isFinite(currentMeasured) && currentMeasured > 0
      ? (currentMeasured * 0.85).toFixed(2)
      : "";
  const targetHelpText =
    metricType === "Energy"
      ? "Set a realistic reduction target in kWh for the reported wastage zone."
      : metricType === "Water"
        ? "Set a capped water loss target in liters for the identified location."
        : metricType === "Emissions"
          ? "Set an emissions reduction target in kg CO2e for this source."
          : "Set an upper limit for food wastage (kg) for this cafeteria area.";

  // Build today's date string for min attribute
  const todayStr = new Date().toISOString().split("T")[0];

  const bodyHTML = `
        <div style="margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:14px;">
                <div>
                    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;">Current ${metricType} Value</div>
                    <div style="font-size:22px;font-weight:700;color:#059669;">${currentValue} <small style="font-size:13px;">${unit}</small></div>
                </div>
                <div style="font-size:12px;color:#6b7280;text-align:right;">Report #${report.id}<br>${report.type} Wastage</div>
            </div>
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;">
                <div style="font-size:12px;font-weight:600;color:#1d4ed8;margin-bottom:6px;">How to set this target</div>
                <div style="font-size:12px;color:#334155;line-height:1.5;">
                    <div>${targetHelpText}</div>
                    <div>Measured current: <strong>${Number.isFinite(currentMeasured) ? currentMeasured : "—"} ${unit}</strong> | Baseline: <strong>${Number.isFinite(currentBaseline) ? currentBaseline : "—"} ${unit}</strong> | End-user estimate: <strong>${Number.isFinite(userProvided) ? userProvided : "—"} ${report?.specificData?.reportedUnit || unit}</strong></div>
                    <div>Recommended starting target: <strong>${suggestedTarget || "—"} ${unit}</strong> (about 15% below current measured value).</div>
                </div>
            </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;">
            <div>
                <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">New Target Value (${unit}) *</label>
                <input type="number" id="mt-value" min="0" step="0.01" placeholder="e.g. ${metricType === "Energy" ? "120" : metricType === "Water" ? "650" : metricType === "Emissions" ? "45" : "18"}" value="${existing.value || suggestedTarget || ""}" style="width:100%;padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;">
                <div style="font-size:11px;color:#9ca3af;margin-top:4px;line-height:1.4;">Use the same unit as the measured/estimated wastage value shown above. Keep the target lower than the current measured value whenever possible.</div>
            </div>
            <div>
                <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Target Deadline *</label>
                <input type="date" id="mt-deadline" min="${todayStr}" value="${existing.deadline || ""}" style="width:100%;padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;">
                <div style="font-size:11px;color:#9ca3af;margin-top:4px;line-height:1.4;">Pick a date by which this target should be met and verified in the next audit cycle.</div>
            </div>
            <div>
                <label style="font-size:12px;font-weight:600;color:#374151;display:block;margin-bottom:4px;">Justification (optional)</label>
                <textarea id="mt-justification" rows="2" placeholder="Based on Finance cost-impact analysis..." style="width:100%;padding:9px 11px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;resize:vertical;font-family:inherit;box-sizing:border-box;">${existing.justification || ""}</textarea>
                <div style="font-size:11px;color:#9ca3af;margin-top:4px;line-height:1.4;">Add assumptions, operational constraints, and why this target is practical for the reported location.</div>
            </div>
        </div>
    `;

  openModal({
    title: "Set New " + metricType + " Target",
    bodyHTML,
    confirmLabel: "Set Target",
    cancelLabel: "Cancel",
    onConfirm: async () => {
      const valueStr = document.getElementById("mt-value")?.value?.trim();
      const deadline = document.getElementById("mt-deadline")?.value?.trim();
      const justification = document
        .getElementById("mt-justification")
        ?.value?.trim();

      // Validate
      if (!valueStr || isNaN(Number(valueStr)) || Number(valueStr) <= 0) {
        showToast("Please enter a valid positive target value.", "warning");
        return false; // modal stays open
      }
      if (!deadline) {
        showToast("Please select a target deadline.", "warning");
        return false;
      }

      const targetPayload = {
        metricTarget: {
          value: parseFloat(valueStr),
          unit: unit,
          deadline: deadline,
          justification: justification || "",
          setAt: new Date().toISOString(),
        },
        targetSetAt: new Date().toISOString(),
      };

      await _updateWastageReport(reportId, {
        status: "Target Set",
        details: targetPayload,
      });

      // Highlight
      SustDB.addHighlight(
        `New ${metricType} Target Set`,
        `Target: ${valueStr} ${unit} by ${new Date(deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} (Report #${reportId}).`,
        "blue",
      );

      showToast(
        `${metricType} target set to ${valueStr} ${unit}.`,
        "success",
        2500,
      );
      notifyOnStateChange(
        { id: reportId },
        "target_set",
        "Sustainability Officer",
      );
      renderBellIcon("notif-container", currentUser.email);
      await renderWastageAuditQueue();
      renderRecentHighlights();
    },
  });
};
