import { useState, useEffect } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import overviewCss from "../../styles/sustainability_officer/sust_overview.css?inline";
import sustLayoutCss from "./sustainability.css?inline";

export default function SustainabilityOverview() {
  const { user } = useAuth();

  const [metrics, setMetrics] = useState({
    energy: "4.9",
    energyUnit: "GWh",
    water: "18.6",
    waterUnit: "ML",
    emissions: "1,284",
    emissionsUnit: "tCO₂e",
    initiatives: 6,
    foodWastage: "742",
    foodUnit: "kg",
  });

  const [wastageReports, setWastageReports] = useState([]);

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      api.get("/sustainability-metrics"),
      api.get("/initiatives"),
      api.get("/wastage-reports"),
    ]).then(([metricsRes, initsRes, wastageRes]) => {
      if (!active) return;

      if (
        metricsRes.status === "fulfilled" &&
        Array.isArray(metricsRes.value) &&
        metricsRes.value.length > 0
      ) {
        const sorted = [...metricsRes.value].sort((a, b) =>
          String(b.period || "").localeCompare(String(a.period || "")),
        );
        const latest = sorted[0];
        setMetrics((prev) => ({
          ...prev,
          energy: latest.energy_consumed ? String(latest.energy_consumed) : prev.energy,
          water: latest.water_usage ? String(latest.water_usage) : prev.water,
          emissions: latest.emissions
            ? Number(latest.emissions).toLocaleString()
            : prev.emissions,
        }));
      }

      if (initsRes.status === "fulfilled" && Array.isArray(initsRes.value)) {
        const activeCount = initsRes.value.filter(
          (i) => i.status !== "completed",
        ).length;
        setMetrics((prev) => ({ ...prev, initiatives: activeCount || 6 }));
      }

      if (
        wastageRes.status === "fulfilled" &&
        Array.isArray(wastageRes.value)
      ) {
        const pending = wastageRes.value.filter(
          (w) => w.status === "Reported" || w.status === "Pending" || !w.status,
        );
        setWastageReports(pending);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const displayName = user?.name || "Maya";

  return (
    <div className="sustainability-overview-page" style={{ width: "100%" }}>
      <style>{overviewCss}</style>
      <style>{sustLayoutCss}</style>
      {/* HEADER */}
      <header
        className="page-header"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "32px",
        }}
      >
        <div>
          <h1 id="welcomeHeading" style={{ margin: "0 0 8px 0" }}>
            Welcome back, {displayName}
          </h1>
          <p style={{ margin: 0 }}>
            Monitor resource usage, review environmental trends, and jump into
            reporting and initiative planning from one sustainability
            workspace.
          </p>
        </div>

        {/* Bell Icon */}
        <div style={{ position: "relative", flexShrink: 0, marginTop: "8px" }}>
          <button
            type="button"
            aria-label="Notifications"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#374151",
              padding: "4px",
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>
        </div>
      </header>

      {/* TOP METRICS (5 Cards in 6-column grid) */}
      <section className="top-metrics-grid">
        {/* 1. Total Energy Consumed */}
        <div className="metric-card">
          <div className="metric-header">
            <h3>Total Energy Consumed</h3>
            <span className="metric-icon" style={{ color: "#10b981", opacity: 0.9 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </span>
          </div>
          <div className="metric-value" id="val-energy">
            {metrics.energy} <small>{metrics.energyUnit}</small>
          </div>
          <p className="metric-desc">
            Equivalent to the combined monthly electricity draw of core
            academic and lab blocks currently under monitoring.
          </p>
        </div>

        {/* 2. Total Water Usage */}
        <div className="metric-card">
          <div className="metric-header">
            <h3>Total Water Usage</h3>
            <span className="metric-icon" style={{ color: "#10b981", opacity: 0.9 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </span>
          </div>
          <div className="metric-value" id="val-water">
            {metrics.water} <small>{metrics.waterUnit}</small>
          </div>
          <p className="metric-desc">
            Represents total metered campus water consumption this cycle
            across utilities, sanitation, and facility operations.
          </p>
        </div>

        {/* 3. Total Emissions */}
        <div className="metric-card">
          <div className="metric-header">
            <h3>Total Emissions</h3>
            <span className="metric-icon" style={{ color: "#10b981", opacity: 0.9 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              </svg>
            </span>
          </div>
          <div className="metric-value" id="val-emissions">
            {metrics.emissions} <small>{metrics.emissionsUnit}</small>
          </div>
          <p className="metric-desc">
            Calculated from current energy mix and usage profile, including
            grid electricity and fuel-linked operational emissions.
          </p>
        </div>

        {/* 4. Active Conservation Initiatives */}
        <div className="metric-card">
          <div className="metric-header">
            <h3>Active Conservation Initiatives</h3>
            <span className="metric-icon" style={{ color: "#10b981", opacity: 0.9 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="9" y1="18" x2="15" y2="18" />
                <line x1="10" y1="22" x2="14" y2="22" />
                <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
              </svg>
            </span>
          </div>
          <div className="metric-value" id="val-initiatives">
            {metrics.initiatives}
          </div>
          <p className="metric-desc">
            Initiatives in execution or review phases that are actively
            contributing to measurable reduction goals.
          </p>
        </div>

        {/* 5. Food Wastage */}
        <div className="metric-card">
          <div className="metric-header">
            <h3>Food Wastage</h3>
            <span className="metric-icon" style={{ color: "#10b981", opacity: 0.9 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </span>
          </div>
          <div className="metric-value" id="val-food-wastage">
            {metrics.foodWastage} <small>{metrics.foodUnit}</small>
          </div>
          <p className="metric-desc">
            Total recoverable and non-recoverable food waste recorded from
            dining and event facilities during the reporting window.
          </p>
        </div>
      </section>

      {/* WASTAGE AUDIT QUEUE */}
      <section className="panel" id="wastageAuditSection" style={{ marginBottom: "22px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <div>
            <h2 className="panel-title" style={{ marginBottom: "4px" }}>
              Wastage Audit Queue
            </h2>
            <p className="panel-subtitle" style={{ marginBottom: 0 }}>
              Cross-check user-reported wastage observations against live
              sensor data. Validate, dismiss, or forward to Finance.
            </p>
          </div>
          <span
            id="wastageQueueCount"
            style={{
              background: "#059669",
              color: "white",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            {wastageReports.length} pending
          </span>
        </div>

        <div id="wastageAuditContainer">
          {wastageReports.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 20px",
                color: "#6b7280",
                fontSize: "14px",
                border: "1px dashed #d8dde2",
                borderRadius: "8px",
              }}
            >
              No wastage reports have been submitted yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {wastageReports.map((report) => (
                <div
                  key={report.wastage_report_id || report.id}
                  style={{
                    padding: "12px 16px",
                    border: "1px solid #d8dde2",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "14px", color: "#111827" }}>
                      {report.type} Wastage Observation
                    </strong>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b7280" }}>
                      Reported by {report.reporter_name || report.reporter_id || "Campus Visitor"}
                    </p>
                  </div>
                  <span
                    style={{
                      background: "#fef3c7",
                      color: "#92400e",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                    }}
                  >
                    Pending Review
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
