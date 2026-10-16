import { useState, useEffect, useCallback } from "react";
import api from "../../api/client";
import monitorCss from "../../styles/sustainability_officer/sust_monitor.css?inline";
import sustLayoutCss from "./sustainability.css?inline";

const PERIOD_DATA = {
  "30 Days": [
    { label: "Week 1", energy: 60, water: 42, emissions: 50, food: 36 },
    { label: "Week 2", energy: 70, water: 46, emissions: 45, food: 40 },
    { label: "Week 3", energy: 55, water: 39, emissions: 42, food: 35 },
    { label: "Week 4", energy: 50, water: 35, emissions: 40, food: 33 },
  ],
  Quarter: [
    { label: "Month 1", energy: 65, water: 45, emissions: 48, food: 38 },
    { label: "Month 2", energy: 72, water: 50, emissions: 52, food: 42 },
    { label: "Month 3", energy: 58, water: 38, emissions: 41, food: 34 },
  ],
  Year: [
    { label: "Q1", energy: 68, water: 46, emissions: 50, food: 39 },
    { label: "Q2", energy: 75, water: 52, emissions: 54, food: 44 },
    { label: "Q3", energy: 62, water: 41, emissions: 44, food: 36 },
    { label: "Q4", energy: 54, water: 36, emissions: 38, food: 32 },
  ],
};

export default function SustainabilityMonitoring() {
  const [metrics, setMetrics] = useState({
    energy: "813",
    energyUnit: "MWh",
    water: "3.6",
    waterUnit: "ML",
    emissions: "217",
    emissionsUnit: "tCO₂e",
    food: "737",
    foodUnit: "kg",
  });

  const [activePeriod, setActivePeriod] = useState("30 Days");
  const [pipelineStep, setPipelineStep] = useState(0); // 0 to 5
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Fetch metrics from backend with fallback
  useEffect(() => {
    let active = true;

    Promise.allSettled([
      api.get("/sustainability-metrics"),
      api.get("/wastage-reports"),
    ]).then(([metricsRes, wastageRes]) => {
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
          energy: latest.energy_consumed
            ? String(Math.round(Number(latest.energy_consumed)))
            : prev.energy,
          water: latest.water_usage
            ? String(Number(latest.water_usage).toFixed(1))
            : prev.water,
          emissions: latest.emissions
            ? String(Math.round(Number(latest.emissions)))
            : prev.emissions,
        }));
      }

      if (
        wastageRes.status === "fulfilled" &&
        Array.isArray(wastageRes.value)
      ) {
        let foodTotal = 0;
        wastageRes.value.forEach((w) => {
          if (w.type === "Food" && w.details?.specificData?.estimatedAmount) {
            foodTotal += parseFloat(w.details.specificData.estimatedAmount) || 0;
          }
        });
        if (foodTotal > 0) {
          setMetrics((prev) => ({ ...prev, food: String(Math.round(foodTotal)) }));
        }
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // Run Animated Pipeline Sync Sequence
  const handleRunSync = () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setPipelineStep(1);

    const interval = setInterval(() => {
      setPipelineStep((prev) => {
        if (prev < 5) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setIsSyncing(false);
          showToast("Sync cycle complete! Upstream data feeds verified.");
          return 5;
        }
      });
    }, 600);
  };

  const chartBars = PERIOD_DATA[activePeriod] || PERIOD_DATA["30 Days"];

  return (
    <div className="sustainability-monitoring-page" style={{ width: "100%" }}>
      <style>{monitorCss}</style>
      <style>{sustLayoutCss}</style>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: toast.type === "error" ? "#ef4444" : "#059669",
            color: "#ffffff",
            padding: "10px 18px",
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
            zIndex: 9999,
            fontWeight: "600",
            fontSize: "13px",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <header className="page-header" style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>
          Environmental Impact Monitoring
        </h1>
      </header>

      {/* 4 TOP METRIC CARDS */}
      <section className="metrics-row">
        {/* 1. Energy Consumption */}
        <div className="metric-card">
          <div className="metric-header">
            <div>
              <h3>Energy Consumption</h3>
              <p>Current electricity and gas usage across all monitors.</p>
            </div>
          </div>
          <div className="metric-val">
            <span id="metricEnergy">{metrics.energy}</span> <small>{metrics.energyUnit}</small>
          </div>
          <div className="metric-footer">
            Upstream feeds completed for 24 of 24 monitored meters in current cycle.
          </div>
        </div>

        {/* 2. Water Usage */}
        <div className="metric-card">
          <div className="metric-header">
            <div>
              <h3>Water Usage</h3>
              <p>Aggregated water intake from facilities and process lines.</p>
            </div>
          </div>
          <div className="metric-val">
            <span id="metricWater">{metrics.water}</span> <small>{metrics.waterUnit}</small>
          </div>
          <div className="metric-footer">
            Building clusters posted below-average demand after optimization changes.
          </div>
        </div>

        {/* 3. Emissions Data */}
        <div className="metric-card">
          <div className="metric-header">
            <div>
              <h3>Emissions Data</h3>
              <p>Calculated emissions feed using current validated factors.</p>
            </div>
          </div>
          <div className="metric-val">
            <span id="metricEmissions">{metrics.emissions}</span> <small>{metrics.emissionsUnit}</small>
          </div>
          <div className="metric-footer">
            Emission factor tables were verified during the latest reporting rules sync.
          </div>
        </div>

        {/* 4. Food Wastage */}
        <div className="metric-card">
          <div className="metric-header">
            <div>
              <h3>Food Wastage</h3>
              <p>
                Consolidated food discard data from kitchens, canteens, and
                event service points.
              </p>
            </div>
          </div>
          <div className="metric-val">
            <span id="metricFood">{metrics.food}</span> <small>{metrics.foodUnit}</small>
          </div>
          <div className="metric-footer">
            Collection logs were reconciled with waste handling records for this cycle.
          </div>
        </div>
      </section>

      {/* DATA PIPELINE */}
      <section className="pipeline-panel">
        <div className="pipeline-header">
          <h2>Data pipeline</h2>
          <p>
            Live visibility into the environmental monitoring workflow from raw
            collection through dashboard refresh.
          </p>
        </div>

        <div className="pipeline-steps" id="monitoringPipeline">
          <div className="pipeline-progress">
            <div className="pipeline-line" />
            <div
              className="pipeline-line-fill"
              id="pipelineFill"
              style={{
                width:
                  pipelineStep === 0
                    ? "0%"
                    : `${((pipelineStep - 1) / 4) * 100}%`,
              }}
            />
          </div>

          {/* Step 1: Collect */}
          <div className={`step ${pipelineStep >= 1 ? "active" : ""}`}>
            <div className={`step-icon ${pipelineStep >= 1 ? "active" : ""}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
            </div>
            <h4>Collect</h4>
          </div>

          {/* Step 2: Aggregate */}
          <div className={`step ${pipelineStep >= 2 ? "active" : ""}`}>
            <div className={`step-icon ${pipelineStep >= 2 ? "active" : ""}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <h4>Aggregate</h4>
          </div>

          {/* Step 3: Calculate Metrics */}
          <div className={`step ${pipelineStep >= 3 ? "active" : ""}`}>
            <div className={`step-icon ${pipelineStep >= 3 ? "active" : ""}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="16" y2="10" />
                <line x1="8" y1="14" x2="16" y2="14" />
                <line x1="8" y1="18" x2="12" y2="18" />
              </svg>
            </div>
            <h4>Calculate Metrics</h4>
          </div>

          {/* Step 4: Trend Analysis */}
          <div className={`step ${pipelineStep >= 4 ? "active" : ""}`}>
            <div className={`step-icon ${pipelineStep >= 4 ? "active" : ""}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
            <h4>Trend Analysis</h4>
          </div>

          {/* Step 5: Update Dashboard */}
          <div className={`step ${pipelineStep >= 5 ? "active" : ""}`}>
            <div className={`step-icon ${pipelineStep >= 5 ? "active" : ""}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </div>
            <h4>Update Dashboard</h4>
          </div>
        </div>
      </section>

      {/* VIEW METRICS & TRENDS */}
      <section className="dashboard-panel full-width" style={{ marginBottom: "24px" }}>
        <h2>View Metrics & Trends</h2>
        <p className="sub">
          Filter chart views by date range and inspect time-based changes
          across all core indicators.
        </p>

        {/* PILL SELECTOR */}
        <div className="pill-nav" id="trendPeriodSelector">
          {["30 Days", "Quarter", "Year"].map((period) => (
            <div
              key={period}
              className={`pill-item ${activePeriod === period ? "active" : ""}`}
              onClick={() => setActivePeriod(period)}
              style={{ cursor: "pointer" }}
            >
              {period}
            </div>
          ))}
        </div>

        {/* GROUPED BARS CHART */}
        <div className="chart-container" id="trendsChart">
          {chartBars.map((item, idx) => (
            <div key={item.label || idx} className="chart-group">
              <div
                className="bar energy"
                style={{ height: `${item.energy * 2.2}px` }}
                title={`Energy: ${item.energy}%`}
              />
              <div
                className="bar water"
                style={{ height: `${item.water * 2.2}px` }}
                title={`Water: ${item.water}%`}
              />
              <div
                className="bar emissions"
                style={{ height: `${item.emissions * 2.2}px` }}
                title={`Emissions: ${item.emissions}%`}
              />
              <div
                className="bar food"
                style={{ height: `${item.food * 2.2}px` }}
                title={`Food: ${item.food}%`}
              />
            </div>
          ))}
        </div>

        {/* LABELS */}
        <div className="chart-labels">
          {chartBars.map((item, idx) => (
            <span key={item.label || idx}>{item.label}</span>
          ))}
        </div>

        {/* LEGEND */}
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-dot energy" />
            Energy
          </div>
          <div className="legend-item">
            <div className="legend-dot water" />
            Water
          </div>
          <div className="legend-item">
            <div className="legend-dot emissions" />
            Emissions
          </div>
          <div className="legend-item">
            <div className="legend-dot food" />
            Food
          </div>
        </div>
      </section>

      {/* BOTTOM ACTION BAR */}
      <section className="action-bar">
        <div className="action-bar-text">
          <h4>More data to be collected?</h4>
          <p>
            The system will automatically trigger the next collection cycle
            when new meter or utility data is detected.
          </p>
        </div>
        <div className="action-btns">
          <button
            type="button"
            className="btn-green"
            id="btnForceRun"
            onClick={handleRunSync}
            disabled={isSyncing}
            style={{
              background: "#059669",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "10px 18px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: isSyncing ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
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
              style={{
                animation: isSyncing ? "spin 1s linear infinite" : "none",
              }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {isSyncing ? "Syncing..." : "Run Sync Cycle"}
          </button>
        </div>
      </section>
    </div>
  );
}
