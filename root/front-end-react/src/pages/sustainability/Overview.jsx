import { useState, useEffect, useCallback } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import Toast from "./components/Toast";
import overviewCss from "../../styles/sustainability_officer/sust_overview.css?inline";
import sustLayoutCss from "./sustainability.css?inline";

export default function SustainabilityOverview() {
  const { user } = useAuth();

  const [summary, setSummary] = useState(null);
  const [activeInitiatives, setActiveInitiatives] = useState(0);
  const [wastageReports, setWastageReports] = useState([]);
  const [userMap, setUserMap] = useState({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  const loadData = useCallback(() => {
    let active = true;

    Promise.allSettled([
      api.get("/sustainability-metrics/summary"),
      api.get("/initiatives"),
      api.get("/wastage-reports"),
      api.get("/users"),
    ])
      .then(([summaryRes, initsRes, wastageRes, usersRes]) => {
        if (!active) return;

        // 1. Process summary data
        if (summaryRes.status === "fulfilled" && summaryRes.value) {
          setSummary(summaryRes.value);
        } else {
          setSummary(null);
        }

        // 2. Process users directory to resolve reporter names
        const directory = {};
        if (usersRes.status === "fulfilled" && Array.isArray(usersRes.value)) {
          usersRes.value.forEach((u) => {
            if (u.user_id && u.name) {
              directory[u.user_id] = u.name;
            }
          });
        }
        setUserMap(directory);

        // 3. Process initiatives: active means not completed and not rejected
        if (initsRes.status === "fulfilled" && Array.isArray(initsRes.value)) {
          const count = initsRes.value.filter(
            (i) => i.status !== "completed" && i.status !== "rejected",
          ).length;
          setActiveInitiatives(count);
        } else {
          setActiveInitiatives(0);
        }

        // 4. Process wastage reports: match pending status (normalized seed)
        if (wastageRes.status === "fulfilled" && Array.isArray(wastageRes.value)) {
          const pending = wastageRes.value.filter((w) => {
            const s = (w.status || "").toLowerCase();
            return s === "pending" || s === "reported" || !s;
          });
          setWastageReports(pending);
        } else {
          setWastageReports([]);
        }
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to load sustainability overview");
        showToast(err.message || "Error loading overview data", "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [showToast]);

  useEffect(() => {
    const cleanup = loadData();
    return cleanup;
  }, [loadData]);

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    loadData();
  };

  const displayName = user?.name || "Sustainability Officer";

  // Real totals and units from summary endpoint
  const totals = summary?.totals;
  const energyDisplay = totals
    ? totals.energy_mwh >= 1000
      ? (totals.energy_mwh / 1000).toFixed(2)
      : totals.energy_mwh.toLocaleString()
    : "0";
  const energyUnit = totals && totals.energy_mwh >= 1000 ? "GWh" : "MWh";

  const waterDisplay = totals ? totals.water_ml.toLocaleString() : "0";
  const waterUnit = "ML";

  const emissionsDisplay = totals ? totals.emissions_t.toLocaleString() : "0";
  const emissionsUnit = "tCO₂e";

  const foodDisplay = totals ? totals.food_kg.toLocaleString() : "0";
  const foodUnit = "kg";

  return (
    <div className="sustainability-overview-page" style={{ width: "100%" }}>
      <style>{overviewCss}</style>
      <style>{sustLayoutCss}</style>

      <Toast toast={toast} onClose={closeToast} />

      {/* HEADER */}
      <header
        className="page-header"
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "28px",
        }}
      >
        <div>
          <h1 id="welcomeHeading" style={{ margin: "0 0 6px 0", fontSize: "28px", fontWeight: "700", color: "#111827" }}>
            Welcome back, {displayName}
          </h1>
          <p style={{ margin: 0, color: "#4b5563", fontSize: "14px" }}>
            Real-time environmental totals, active initiatives, and community audit queue from live sensors and records.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          aria-label="Refresh overview data"
          style={{
            background: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            padding: "8px 14px",
            fontSize: "13px",
            fontWeight: "600",
            color: "#374151",
            cursor: loading ? "default" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: loading ? "spin 1s linear infinite" : "none" }}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      {/* ERROR STATE */}
      {error && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "16px 20px",
            borderRadius: "8px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <strong>Unable to load overview:</strong> {error}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            style={{
              background: "#991b1b",
              color: "#ffffff",
              border: "none",
              padding: "6px 14px",
              borderRadius: "4px",
              fontWeight: "600",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* TOP METRICS (5 Cards) */}
      <section
        className="top-metrics-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        {/* 1. Total Energy Consumed */}
        <div
          className="metric-card"
          style={{
            background: "#ffffff",
            border: "1px solid #d8dde2",
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#374151" }}>
              Total Energy Consumed
            </h3>
            <span style={{ color: "#059669" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </span>
          </div>
          <div
            className="metric-value"
            id="val-energy"
            style={{ fontSize: "26px", fontWeight: "700", color: "#111827", fontVariantNumeric: "tabular-nums" }}
          >
            {loading ? "..." : energyDisplay} <small style={{ fontSize: "13px", color: "#6b7280" }}>{energyUnit}</small>
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#6b7280", lineHeight: 1.4 }}>
            Aggregated electricity draw across all active campus meters in reporting period.
          </p>
        </div>

        {/* 2. Total Water Usage */}
        <div
          className="metric-card"
          style={{
            background: "#ffffff",
            border: "1px solid #d8dde2",
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#374151" }}>
              Total Water Usage
            </h3>
            <span style={{ color: "#0284c7" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </span>
          </div>
          <div
            className="metric-value"
            id="val-water"
            style={{ fontSize: "26px", fontWeight: "700", color: "#111827", fontVariantNumeric: "tabular-nums" }}
          >
            {loading ? "..." : waterDisplay} <small style={{ fontSize: "13px", color: "#6b7280" }}>{waterUnit}</small>
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#6b7280", lineHeight: 1.4 }}>
            Metered intake across utilities, sanitation, and academic facility operations.
          </p>
        </div>

        {/* 3. Total Emissions */}
        <div
          className="metric-card"
          style={{
            background: "#ffffff",
            border: "1px solid #d8dde2",
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#374151" }}>
              Total Emissions
            </h3>
            <span style={{ color: "#7c3aed" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
              </svg>
            </span>
          </div>
          <div
            className="metric-value"
            id="val-emissions"
            style={{ fontSize: "26px", fontWeight: "700", color: "#111827", fontVariantNumeric: "tabular-nums" }}
          >
            {loading ? "..." : emissionsDisplay} <small style={{ fontSize: "13px", color: "#6b7280" }}>{emissionsUnit}</small>
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#6b7280", lineHeight: 1.4 }}>
            Calculated from grid electricity using the verified 0.82 kg CO₂/kWh factor.
          </p>
        </div>

        {/* 4. Active Conservation Initiatives */}
        <div
          className="metric-card"
          style={{
            background: "#ffffff",
            border: "1px solid #d8dde2",
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#374151" }}>
              Active Initiatives
            </h3>
            <span style={{ color: "#059669" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="9" y1="18" x2="15" y2="18" />
                <line x1="10" y1="22" x2="14" y2="22" />
                <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
              </svg>
            </span>
          </div>
          <div
            className="metric-value"
            id="val-initiatives"
            style={{ fontSize: "26px", fontWeight: "700", color: "#111827", fontVariantNumeric: "tabular-nums" }}
          >
            {loading ? "..." : activeInitiatives}
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#6b7280", lineHeight: 1.4 }}>
            Programs currently in progress, proposed, or approved for campus carbon reduction.
          </p>
        </div>

        {/* 5. Food Wastage */}
        <div
          className="metric-card"
          style={{
            background: "#ffffff",
            border: "1px solid #d8dde2",
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#374151" }}>
              Food Wastage
            </h3>
            <span style={{ color: "#d97706" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </span>
          </div>
          <div
            className="metric-value"
            id="val-food-wastage"
            style={{ fontSize: "26px", fontWeight: "700", color: "#111827", fontVariantNumeric: "tabular-nums" }}
          >
            {loading ? "..." : foodDisplay} <small style={{ fontSize: "13px", color: "#6b7280" }}>{foodUnit}</small>
          </div>
          <p style={{ margin: "6px 0 0 0", fontSize: "12px", color: "#6b7280", lineHeight: 1.4 }}>
            Recorded discard across dining, canteens, and campus catering service points.
          </p>
        </div>
      </section>

      {/* WASTAGE AUDIT QUEUE */}
      <section
        className="panel"
        id="wastageAuditSection"
        style={{
          background: "#ffffff",
          border: "1px solid #d8dde2",
          borderRadius: "8px",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "18px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h2 className="panel-title" style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#111827" }}>
              Wastage Audit Queue
            </h2>
            <p className="panel-subtitle" style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6b7280" }}>
              Verify reported campus observations against live sensor telemetry before archiving.
            </p>
          </div>
          <span
            id="wastageQueueCount"
            style={{
              background: wastageReports.length > 0 ? "#059669" : "#6b7280",
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
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: "36px 20px",
                color: "#6b7280",
                fontSize: "14px",
              }}
            >
              Loading wastage audit queue...
            </div>
          ) : wastageReports.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "#6b7280",
                fontSize: "14px",
                border: "1px dashed #d8dde2",
                borderRadius: "8px",
              }}
            >
              No pending wastage reports in the audit queue. All observations have been processed.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {wastageReports.map((report) => {
                const reportId = report.wastage_report_id || report.id;
                const reporterName =
                  userMap[report.reporter_id] || report.reporter_name || `Reporter #${(report.reporter_id || "").slice(-4)}`;
                const specData = report.details?.specificData || {};
                const desc =
                  specData.observation ||
                  specData.nature ||
                  specData.typeOfWastage ||
                  "Community wastage report logged.";
                const location = specData.location || specData.building || specData.cafeteria || "Campus";

                return (
                  <div
                    key={reportId}
                    style={{
                      padding: "14px 18px",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      background: "#f9fafb",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <strong style={{ fontSize: "14px", color: "#111827" }}>
                          {report.type} Wastage Observation
                        </strong>
                        <span
                          style={{
                            fontSize: "11px",
                            background: "#e5e7eb",
                            color: "#374151",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {location}
                        </span>
                      </div>
                      <p style={{ margin: "2px 0 4px 0", fontSize: "13px", color: "#4b5563" }}>
                        {desc}
                      </p>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        Reported by <strong>{reporterName}</strong> &bull; Priority: {report.details?.priority || "Normal"}
                      </span>
                    </div>

                    <span
                      style={{
                        background: "#fef3c7",
                        color: "#92400e",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        flexShrink: 0,
                      }}
                    >
                      Pending Review
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
