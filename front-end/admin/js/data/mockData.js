/**
 * mockData.js
 * Central in-memory data store for EnerTrack Admin.
 * Simulates backend responses. All CRUD operations mutate these arrays.
 */

const EnerTrackDB = {

  /* ── SESSION ─────────────────────────────────────── */
  session: {
    user: {
      id: "u-001",
      name: "Aadithya Mouli",
      initials: "AM",
      role: "admin",          // "superuser" | "admin" | "enduser"
      email: "a.mouli@enertrack.io",
      lastLogin: "2024-09-21T04:00:00Z"
    }
  },

  /* ── ALERTS ──────────────────────────────────────── */
  alerts: [
    {
      id: "alt-001",
      title: "Storage Capacity Critical",
      description: "Database Volume-1 is at 94% capacity. Immediate cleanup or expansion required.",
      severity: "danger",
      server: "DB-Prod-01",
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      resolved: false
    },
    {
      id: "alt-002",
      title: "High CPU Utilization Spike",
      description: "Web server node experienced an 85% CPU load spike for 5 minutes.",
      severity: "warning",
      server: "Web-Node-03",
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      resolved: false
    },
    {
      id: "alt-003",
      title: "API Latency Warning",
      description: "Payment gateway API endpoint response time exceeded 800 ms threshold.",
      severity: "warning",
      server: "Payment-API",
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      resolved: false
    }
  ],

  /* ── BACKUP JOBS ─────────────────────────────────── */
  backupJobs: [
    {
      id: "bk-001",
      name: "Production DB - full backup",
      scope: "All schemas",
      target: "s3://backups/prod/full",
      status: "ready",           // "ready" | "running" | "pending" | "scheduled" | "failed"
      progress: 100,
      lastRun: "02:00 AM",
      duration: "45m",
      errors: 0,
      nextRun: "Tonight 02:00 AM",
      jobId: "BK-2024-09-21-FULL"
    },
    {
      id: "bk-002",
      name: "Logs & configs - incremental",
      scope: "/var/log, /etc",
      target: "s3://backups/prod/logs",
      status: "pending",
      progress: 40,
      lastRun: null,
      duration: null,
      errors: 0,
      nextRun: "In progress",
      jobId: "BK-2024-09-21-LOG"
    },
    {
      id: "bk-003",
      name: "Staging DB - nightly snapshot",
      scope: "staging schemas",
      target: "local snapshot",
      status: "scheduled",
      progress: 0,
      lastRun: "Yesterday 03:05 AM",
      duration: "18m",
      errors: 0,
      nextRun: "Tonight 03:00 AM",
      jobId: "BK-2024-09-21-STG",
      retention: "7 days"
    }
  ],

  /* ── SYSTEM UPDATES ──────────────────────────────── */
  systemUpdates: [
    {
      id: "upd-001",
      title: "Ubuntu security patches",
      description: "Reboot required • Affects 4 nodes",
      details: "Critical vulnerabilities fix (CVE-2024-XXXX). Reboot required.",
      status: "not-applied",     // "not-applied" | "planned" | "applied" | "scheduled"
      downtimeEst: "5 min",
      changeRequestId: null,
      scheduledWindow: "Tonight 02:00 AM",
      affectedNodes: 4
    },
    {
      id: "upd-002",
      title: "Database engine minor upgrade",
      description: "From 13.9 to 13.10 • Zero-downtime planned",
      details: "Performance improvements and minor bug fixes.",
      status: "planned",
      downtimeEst: "0 min",
      changeRequestId: "CR-2048",
      scheduledWindow: "Tonight 02:00 AM",
      affectedNodes: 1
    },
    {
      id: "upd-003",
      title: "Redis Cache Version Update",
      description: "Upgrade from v6.2 to v7.0 for performance improvements.",
      details: "Major version upgrade with improved memory efficiency.",
      status: "scheduled",
      downtimeEst: "2 min",
      changeRequestId: "CR-2049",
      scheduledWindow: "Tonight 02:00 AM",
      affectedNodes: 2
    }
  ],

  /* ── SYSTEM HEALTH ───────────────────────────────── */
  systemHealth: {
    lastRefresh: new Date().toISOString(),
    services: [
      {
        id: "svc-001",
        name: "Core services",
        description: "API gateway, auth, database, cache",
        status: "healthy",   // "healthy" | "warning" | "degraded"
        healthyCount: 4,
        totalCount: 4,
        latency: "120 ms p95"
      },
      {
        id: "svc-002",
        name: "Background workers",
        description: "Queues, schedulers, reporting jobs",
        status: "warning",
        queueDepth: 1200,
        oldestJob: "2m 10s",
        throughput: "480 jobs/min"
      },
      {
        id: "svc-003",
        name: "External dependencies",
        description: "Payment provider, email, SMS, SSO",
        status: "degraded",
        note: "Payment-API latency slightly elevated",
        errorRate: "0.9%"
      }
    ],
    activeAlerts: [
      { id: "ma-001", title: "Payment-API latency", severity: "warning", desc: "p95 > 250 ms for 5 minutes", time: "04:22", region: "eu-west-1" },
      { id: "ma-002", title: "Worker queue depth", severity: "warning", desc: "High-priority jobs pending > 1k", time: "04:28", note: "Throughput recovering after spike" }
    ],
    metrics: {
      cpu: { avg: 62, peak: 78, label: "CPU & memory", scope: "Across all application nodes • Last 15 minutes", memory: 68 },
      requests: { perMin: 8400, successRate: 99.96, errorRate: 0.04, label: "Requests & errors", scope: "All HTTP endpoints • Last 5 minutes", barWidth: 90 }
    },
    slo: { target: 99.9, current: 99.93 }
  },

  /* ── PERFORMANCE STATS (Overview) ───────────────── */
  performanceStats: {
    systemHealth: { value: "99.9%", note: "All systems operational" },
    avgCpuLoad:   { value: "42%",   note: "Normal operating range" },
    lastBackup:   { value: "2h ago", note: "Completed successfully at 04:00 AM" }
  },

  /* ── ERROR SCAN RESULTS ──────────────────────────── */
  errorScans: [
    {
      id: "scan-001",
      check: "Backup verification",
      status: "passed",
      time: "04:15",
      details: "Verified 245 GB • 0 checksum mismatches detected.",
      description: "Checksum and restore-test sample"
    },
    {
      id: "scan-002",
      check: "Service health checks",
      status: "issues",
      time: "04:22",
      details: "Payment-API latency slightly above baseline, review before logout.",
      description: "APIs, queues, background workers"
    }
  ],

  /* ── MAINTENANCE WINDOW ──────────────────────────── */
  maintenanceWindow: {
    next: "Tonight 02:00 AM - 03:00 AM",
    lastRun: "2024-09-21T02:00:00Z",
    status: "scheduled"
  }
};

export default EnerTrackDB;
