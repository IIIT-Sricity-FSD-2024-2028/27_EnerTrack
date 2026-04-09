/**
 * monitor.js
 * Read + render logic for the System Health / Performance Metrics page.
 * No destructive CRUD here — health data is refreshed, not user-edited.
 * Used by: admin_monitor.html
 */

import EnerTrackDB from "../data/mockData.js";
import { showToast, badgeHTML } from "../utils/utils.js";

/* ── RENDER SYSTEM HEALTH ─────────────────────────── */

export function renderSystemHealth(containerId = "systemHealthContainer") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { services } = EnerTrackDB.systemHealth;

  const statusConfig = {
    healthy:  { badge: badgeHTML("healthy"),  footerFn: s => `${s.healthyCount} / ${s.totalCount} healthy • No degraded services<span class="muted" style="margin-left:12px">Latency: ${s.latency}</span>` },
    warning:  { badge: badgeHTML("warning"),  footerFn: s => `Queue depth: ${s.queueDepth?.toLocaleString()} • Oldest job: ${s.oldestJob}<span class="muted" style="margin-left:12px">Throughput: ${s.throughput}</span>` },
    degraded: { badge: badgeHTML("degraded"), footerFn: s => `${s.note}<span class="muted" style="margin-left:12px">Error rate: ${s.errorRate}</span>` }
  };

  container.innerHTML = services.map(svc => {
    const cfg = statusConfig[svc.status] || statusConfig.warning;
    return `
      <div class="status-card" data-svc-id="${svc.id}">
        <div class="status-header">
          <h4>${svc.name}</h4>
          ${cfg.badge}
        </div>
        <p class="desc">${svc.description}</p>
        <div class="status-footer">
          <span>${cfg.footerFn(svc)}</span>
        </div>
      </div>
    `;
  }).join("");
}

/* ── RENDER PERFORMANCE METRICS ───────────────────── */

export function renderPerformanceMetrics(containerId = "perfMetricsContainer") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { cpu, requests } = EnerTrackDB.systemHealth.metrics;

  container.innerHTML = `
    <div class="metric-block">
      <div class="metric-top">
        <h4>${cpu.label}</h4>
        <span class="muted">${cpu.scope}</span>
      </div>
      <div class="progress-bar-thick">
        <div class="progress" style="width:${cpu.memory}%"></div>
      </div>
      <div class="metric-bottom">
        <span>CPU: ${cpu.avg}% avg • ${cpu.peak}% peak</span>
        <span class="muted">Memory: ${cpu.memory}% used</span>
      </div>
    </div>

    <div class="metric-block">
      <div class="metric-top">
        <h4>${requests.label}</h4>
        <span class="muted">${requests.scope}</span>
      </div>
      <div class="progress-bar-thick">
        <div class="progress" style="width:${requests.barWidth}%"></div>
      </div>
      <div class="metric-bottom">
        <span>Requests: ${(requests.perMin/1000).toFixed(1)}k/min • ${requests.successRate}% success</span>
        <span class="muted">Error rate: ${requests.errorRate}%</span>
      </div>
    </div>
  `;
}

/* ── RENDER SLO / ERROR BUDGET ────────────────────── */

export function renderSloCard(containerId = "sloContainer") {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { slo } = EnerTrackDB.systemHealth;
  const withinSlo = slo.current >= slo.target;

  container.innerHTML = `
    <div class="status-card">
      <div class="status-header">
        <h4>Error budget</h4>
        <span class="badge" style="background:${withinSlo?"darkgreen":"#dc2626"};color:white">
          ${withinSlo ? "Within SLO" : "SLO Breach"}
        </span>
      </div>
      <div class="status-footer">
        <span>SLO: ${slo.target}% • Current: ${slo.current}%</span>
      </div>
    </div>
  `;
}

/* ── MANUAL REFRESH ───────────────────────────────── */

export function refreshMonitorData() {
  // Simulate a data refresh by slightly varying metrics
  const m = EnerTrackDB.systemHealth.metrics;
  m.cpu.avg  = Math.min(95, Math.max(20, m.cpu.avg  + (Math.random() * 6 - 3) | 0));
  m.cpu.peak = Math.min(99, Math.max(m.cpu.avg + 5, m.cpu.peak + (Math.random() * 4 - 2) | 0));
  m.cpu.memory = Math.min(95, Math.max(30, m.cpu.memory + (Math.random() * 4 - 2) | 0));
  m.requests.perMin = Math.round(m.requests.perMin + (Math.random() * 400 - 200));
  EnerTrackDB.systemHealth.lastRefresh = new Date().toISOString();

  renderSystemHealth();
  renderPerformanceMetrics();

  const stamp = document.getElementById("refreshStamp");
  if (stamp) stamp.textContent = "Just now";

  showToast("Monitor data refreshed.", "info", 2000);
}

/* ── EXPORT NAMESPACE ─────────────────────────────── */

const MonitorModule = {
  renderSystemHealth,
  renderPerformanceMetrics,
  renderSloCard,
  refreshMonitorData
};

window.MonitorModule = MonitorModule;
export default MonitorModule;
