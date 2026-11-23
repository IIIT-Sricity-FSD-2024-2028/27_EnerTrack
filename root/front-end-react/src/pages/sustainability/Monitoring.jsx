import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import api from "../../api/client";
import Toast from "./components/Toast";
import MetricCard from "./components/MetricCard";
import BuildingsTable from "./components/BuildingsTable";
import { monitoringPeriods } from "./periods";
import monitorCss from "../../styles/sustainability_officer/sust_monitor.css?inline";
import sustLayoutCss from "./sustainability.css?inline";

const PERIOD_KEYS = ["month", "quarter", "year"];

/** Readings are monthly totals, so the chart is always one bar per month. */
function summaryUrl(period) {
  return `/sustainability-metrics/summary?from=${period.from}&to=${period.to}&granularity=month&groupBy=building`;
}

function formatChartLabel(label) {
  if (!label) return "";
  return label.split(" ")[0];
}

const METRIC_CONFIG = {
  energy: { label: "Electricity", unit: "MWh", field: "energy_mwh" },
  water: { label: "Water", unit: "kL", field: "water_kl" },
  emissions: { label: "Emissions", unit: "t CO₂e", field: "emissions_t" },
  food: { label: "Food waste", unit: "kg", field: "food_kg" },
};

const BAR = "#2d5a43";
const BAR_HOVER = "#1b3a2b";

const fmt = (n, digits = 0) =>
  Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Width of an element, kept up to date as it resizes. */
function useWidth(ref, fallback) {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export default function SustainabilityMonitoring() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Built once per mount from today's date, so the windows never go stale.
  const periods = useMemo(() => monitoringPeriods(), []);
  const [activePeriod, setActivePeriod] = useState("year");
  const [selectedMetric, setSelectedMetric] = useState("energy");
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [raisingAlert, setRaisingAlert] = useState(null);
  // Meters that already have an open alert, so they are not reported twice.
  const [openAlerts, setOpenAlerts] = useState(() => new Set());

  useEffect(() => {
    let ignore = false;
    api
      .get("/alerts")
      .then((res) => {
        if (ignore || !Array.isArray(res)) return;
        setOpenAlerts(new Set(res.filter((a) => a.status !== "resolved").map((a) => a.meter_id)));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);
  // building_id → name, for listing silent meters by where they are.
  const [buildingNames, setBuildingNames] = useState({});

  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  // Fetch data on period change without synchronous setState inside the effect body
  useEffect(() => {
    let ignore = false;

    api
      .get(summaryUrl(periods[activePeriod]))
      .then((res) => {
        if (!ignore) {
          setData(res);
          setLastUpdated(new Date());
          setError(null);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || "Failed to fetch sustainability metrics summary");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [activePeriod, periods]);

  // Building names are only decoration for the silent-meter list; if they
  // fail to load, the list falls back to showing the meter code alone.
  useEffect(() => {
    let ignore = false;
    api
      .get("/buildings")
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data;
        if (ignore || !Array.isArray(list)) return;
        setBuildingNames(Object.fromEntries(list.map((b) => [b.building_id, b.name])));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  // Report a silent or faulty meter to the technicians (their Alerts page).
  const handleRaiseAlert = async (meter, building) => {
    setRaisingAlert(meter.meter_id);
    try {
      await api.post("/alerts", {
        meter_id: meter.meter_id,
        title: `${meter.meter_code} (${building.name}) ${meter.issue}: ${periods[activePeriod].label}`,
        severity: meter.status === "faulty" ? "high" : "medium",
        status: "open",
      });
      setOpenAlerts((set) => new Set(set).add(meter.meter_id));
      showToast(`Alert raised for ${meter.meter_code}. It is now on the technicians' Alerts page.`, "success");
    } catch (err) {
      showToast(err.message || "The alert could not be raised.", "error");
    } finally {
      setRaisingAlert(null);
    }
  };

  const handlePeriodChange = (periodKey) => {
    setActivePeriod(periodKey);
    setLoading(true);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await api.get(summaryUrl(periods[activePeriod]));
      setData(res);
      setLastUpdated(new Date());
      showToast("Readings reloaded.", "success");
    } catch (err) {
      const msg = err.message || "Failed to fetch sustainability metrics summary";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  // SVG Chart Calculations: one bar per month, every value a sum of readings.
  // The chart is drawn at the width of its container, so it fits a phone
  // without scrolling and labels keep their size.
  const chartBoxRef = useRef(null);
  const boxWidth = useWidth(chartBoxRef, 760);
  const series = data?.series || [];
  const prev = data?.previous_totals;
  const coverage = data?.meter_coverage;
  const silentMeters = data?.silent_meters || [];
  const factors = data?.emission_factors;
  const currentMetricCfg = METRIC_CONFIG[selectedMetric] || METRIC_CONFIG.energy;
  const values = series.map((s) => Number(s[currentMetricCfg.field] || 0));
  const rawMax = values.length > 0 ? Math.max(...values, 1) : 1;
  const chartMax = Math.ceil(rawMax * 1.15); // headroom

  const chartW = Math.max(280, boxWidth);
  const chartH = chartW < 480 ? 220 : 260;
  const padLeft = 48;
  const padRight = 8;
  const padTop = 24;
  const padBottom = 40;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    value: Number((chartMax * pct).toFixed(chartMax > 10 ? 0 : 2)),
    y: padTop + plotH * (1 - pct),
  }));

  const colWidth = series.length > 0 ? plotW / series.length : plotW;
  const barWidth = Math.max(8, Math.min(44, colWidth * 0.55));
  // Thin out month labels when bars are narrow so they never overlap.
  const labelEvery = colWidth < 30 ? 2 : 1;

  // "Previous period: 893.4 MWh", or a plain note when there is nothing to compare.
  const prevLine = (value, unit, digits = 0) =>
    !prev ? null : value > 0 ? `Previous period: ${fmt(value, digits)} ${unit}` : "No readings for the previous period";
  const deltaFor = (pct, prevValue) => (prev && prevValue > 0 ? pct : null);

  return (
    <div className="sustainability-monitoring-page" style={{ width: "100%" }}>
      <style>{monitorCss}</style>
      <style>{sustLayoutCss}</style>

      <Toast toast={toast} onClose={closeToast} />

      {/* HEADER */}
      <header
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: 0 }}>
            Monitoring
          </h1>
          <p style={{ margin: "6px 0 0 0", color: "#4b5563", fontSize: "14px" }}>
            Monthly meter readings, emissions, and which meters reported.
          </p>
        </div>

        {/* Top Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {lastUpdated && (
            <span
              style={{
                fontSize: "12px",
                color: "#6b7280",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}

          <button
            type="button"
            id="btnForceRun"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            aria-label="Refresh data"
            style={{
              background: "#ffffff",
              color: "#111827",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              padding: "8px 14px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: isRefreshing ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              opacity: isRefreshing ? 0.75 : 1,
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                animation: isRefreshing ? "spin 1s linear infinite" : "none",
              }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {/* ERROR STATE */}
      {error && !loading && (
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
            <strong>Readings could not be loaded.</strong> {error}
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
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

      {/* TOP 4 METRIC CARDS */}
      <section
        className="metrics-row"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <MetricCard
          id="metricEnergy"
          title="Electricity"
          value={loading ? "…" : fmt(data?.totals?.energy_mwh, 1)}
          unit="MWh"
          delta={deltaFor(data?.change?.energy_pct, prev?.energy_kwh)}
          description="Grid electricity used."
          footer={loading ? null : prevLine((prev?.energy_kwh || 0) / 1000, "MWh", 1)}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          }
        />

        <MetricCard
          id="metricWater"
          title="Water"
          value={loading ? "…" : fmt(data?.totals?.water_kl)}
          unit="kL"
          delta={deltaFor(data?.change?.water_pct, prev?.water_kl)}
          description="Metered water intake."
          footer={loading ? null : prevLine(prev?.water_kl, "kL")}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          }
        />

        <MetricCard
          id="metricEmissions"
          title="Emissions"
          value={loading ? "…" : fmt(data?.totals?.emissions_t, 1)}
          unit="t CO₂e"
          delta={deltaFor(data?.change?.emissions_pct, prev?.emissions_kg)}
          description={
            factors
              ? `Gas at ${factors.gas_kg_per_m3} kg/m³ (Scope 1) + electricity at ${factors.grid_kg_per_kwh} kg/kWh (Scope 2).`
              : "Gas (Scope 1) + electricity (Scope 2)."
          }
          footer={
            loading || !data?.totals ? null : (
              <span>
                Scope 1: {fmt((data.totals.scope1_kg || 0) / 1000, 1)} t · Scope 2: {fmt((data.totals.scope2_kg || 0) / 1000, 1)} t
              </span>
            )
          }
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
          }
        />

        <MetricCard
          id="metricFood"
          title="Food waste"
          value={loading ? "…" : fmt(data?.totals?.food_kg)}
          unit="kg"
          delta={deltaFor(data?.change?.food_pct, prev?.food_kg)}
          description="Bin weights and wastage reports."
          footer={loading ? null : prevLine(prev?.food_kg, "kg")}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M6 6l1 14h10l1-14" />
            </svg>
          }
        />
      </section>

      {/* DATA COVERAGE: which meters actually reported in the period */}
      <section
        className="coverage-panel"
        aria-labelledby="coverageHeading"
        style={{
          background: "#ffffff",
          border: "1px solid #d8dde2",
          borderRadius: "8px",
          padding: "20px 24px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
          <div>
            <h2 id="coverageHeading" style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#111827" }}>
              Data coverage
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6b7280" }}>
              {periods[activePeriod].label}. Totals above only include meters that sent readings.
            </p>
          </div>
          {coverage && !loading && (
            <span
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color: silentMeters.length === 0 ? "#065f46" : "#92400e",
                background: silentMeters.length === 0 ? "#ecfdf5" : "#fef3c7",
                padding: "4px 10px",
                borderRadius: "4px",
              }}
            >
              {silentMeters.length === 0
                ? "Every active meter reported"
                : `${silentMeters.length} active meter${silentMeters.length === 1 ? "" : "s"} silent`}
            </span>
          )}
        </div>

        {loading || !coverage ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>{loading ? "Loading coverage…" : "No meter data."}</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
              {[
                {
                  label: "Reporting",
                  value: `${coverage.active_reporting} of ${coverage.active}`,
                  hint: "active meters with readings",
                  tone: coverage.active_reporting >= coverage.active ? "#065f46" : "#92400e",
                },
                { label: "Faulty", value: coverage.faulty, hint: "readings may be incomplete", tone: coverage.faulty ? "#991b1b" : "#374151" },
                { label: "Calibrating", value: coverage.calibrating, hint: "readings may be off", tone: coverage.calibrating ? "#92400e" : "#374151" },
                { label: "Decommissioned", value: coverage.decommissioned, hint: "no longer counted", tone: "#374151" },
              ].map((c) => (
                <div key={c.label} style={{ borderTop: "3px solid #e5e7eb", paddingTop: "8px" }}>
                  <div style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>{c.label}</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: c.tone, fontVariantNumeric: "tabular-nums" }}>{c.value}</div>
                  <div style={{ fontSize: "11px", color: "#9ca3af" }}>{c.hint}</div>
                </div>
              ))}
            </div>

            {silentMeters.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <h3 style={{ margin: "0 0 6px 0", fontSize: "13px", fontWeight: "700", color: "#92400e" }}>
                  Silent meters (active, but no readings in this period)
                </h3>
                <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "#374151" }}>
                  {silentMeters.map((m) => (
                    <li key={m.meter_id}>
                      <strong>{m.meter_code}</strong> ({m.meter_type})
                      {buildingNames[m.building_id] ? ` · ${buildingNames[m.building_id]}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* METRICS & TRENDS REAL SVG CHART */}
      <section
        className="dashboard-panel full-width"
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
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#111827" }}>
              Monthly trend
            </h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6b7280" }}>
              {periods[activePeriod].label}: one bar per month, each the sum of that month's readings.
            </p>
          </div>

          {/* Time range selector */}
          <div
            className="pill-nav"
            id="trendPeriodSelector"
            role="tablist"
            aria-label="Time period selection"
            style={{
              display: "inline-flex",
              background: "#f3f4f6",
              padding: "3px",
              borderRadius: "6px",
            }}
          >
            {PERIOD_KEYS.map((period) => (
              <button
                type="button"
                key={period}
                role="tab"
                aria-selected={activePeriod === period}
                title={periods[period].label}
                onClick={() => handlePeriodChange(period)}
                style={{
                  background: activePeriod === period ? "#ffffff" : "transparent",
                  color: activePeriod === period ? "#111827" : "#6b7280",
                  border: "none",
                  borderRadius: "4px",
                  padding: "6px 14px",
                  fontSize: "13px",
                  fontWeight: activePeriod === period ? "600" : "500",
                  cursor: "pointer",
                  boxShadow: activePeriod === period ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                }}
              >
                {periods[period].name}
              </button>
            ))}
          </div>
        </div>

        {/* Metric Selector Tabs */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            borderBottom: "1px solid #e5e7eb",
            paddingBottom: "12px",
            marginBottom: "20px",
            flexWrap: "wrap",
          }}
        >
          {Object.entries(METRIC_CONFIG).map(([key, cfg]) => {
            const isSelected = selectedMetric === key;
            return (
              <button
                type="button"
                key={key}
                aria-pressed={isSelected}
                onClick={() => setSelectedMetric(key)}
                style={{
                  background: isSelected ? "#eef4f0" : "#ffffff",
                  color: isSelected ? "#1b3a2b" : "#4b5563",
                  border: isSelected ? `1px solid ${BAR}` : "1px solid #d1d5db",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "13px",
                  fontWeight: isSelected ? "600" : "500",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {cfg.label} ({cfg.unit})
              </button>
            );
          })}
        </div>

        {/* REAL SVG CHART */}
        <div ref={chartBoxRef} style={{ width: "100%" }}>
          {series.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "#6b7280",
                fontSize: "14px",
              }}
            >
              No readings for this period.
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                style={{ width: "100%", height: "auto", display: "block" }}
                aria-label={`Chart of ${currentMetricCfg.label}, ${periods[activePeriod].label}`}
              >
                {/* Horizontal grid lines & Y labels */}
                {yTicks.map((tick, i) => (
                  <g key={i}>
                    <line
                      x1={padLeft}
                      y1={tick.y}
                      x2={chartW - padRight}
                      y2={tick.y}
                      stroke="#e5e7eb"
                      strokeDasharray={i === 0 ? "none" : "3 3"}
                    />
                    <text
                      x={padLeft - 8}
                      y={tick.y + 4}
                      fill="#6b7280"
                      fontSize="11"
                      textAnchor="end"
                      fontFamily="Inter, sans-serif"
                    >
                      {tick.value}
                    </text>
                  </g>
                ))}

                {/* Y-axis Unit Label */}
                <text
                  x={padLeft}
                  y={padTop - 8}
                  fill="#6b7280"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="Inter, sans-serif"
                >
                  {currentMetricCfg.unit}
                </text>

                {/* Bars & X Labels */}
                {series.map((s, idx) => {
                  const val = Number(s[currentMetricCfg.field] || 0);
                  const barH = chartMax > 0 ? (val / chartMax) * plotH : 0;
                  const xCenter = padLeft + idx * colWidth + colWidth / 2;
                  const barX = xCenter - barWidth / 2;
                  const barY = padTop + (plotH - barH);
                  const isHovered = hoveredPoint === idx;

                  return (
                    <g key={s.period || idx}>
                      {/* Interactive Bar */}
                      <rect
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={Math.max(2, barH)}
                        rx="3"
                        fill={isHovered ? BAR_HOVER : BAR}
                        style={{ cursor: "pointer", transition: "fill 0.15s" }}
                        tabIndex={0}
                        aria-label={`${s.label}: ${fmt(val, val < 100 ? 1 : 0)} ${currentMetricCfg.unit}`}
                        onMouseEnter={() => setHoveredPoint(idx)}
                        onMouseLeave={() => setHoveredPoint(null)}
                        onFocus={() => setHoveredPoint(idx)}
                        onBlur={() => setHoveredPoint(null)}
                      />

                      {/* X Label */}
                      <text
                        x={xCenter}
                        y={chartH - 12}
                        fill="#4b5563"
                        fontSize="11"
                        textAnchor="middle"
                        fontFamily="Inter, sans-serif"
                      >
                        {idx % labelEvery === 0 || idx === series.length - 1 ? formatChartLabel(s.label) : ""}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Tooltip Overlay */}
              {hoveredPoint !== null && series[hoveredPoint] && (
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "24px",
                    background: "#111827",
                    color: "#ffffff",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    pointerEvents: "none",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.15)",
                  }}
                >
                  <strong>{series[hoveredPoint].label}</strong>:{" "}
                  {fmt(series[hoveredPoint][currentMetricCfg.field], Number(series[hoveredPoint][currentMetricCfg.field]) < 100 ? 1 : 0)}{" "}
                  {currentMetricCfg.unit}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {!loading && (
        <BuildingsTable
          rows={data?.by_building}
          metric={selectedMetric}
          periodLabel={periods[activePeriod].label}
          onRaiseAlert={handleRaiseAlert}
          raising={raisingAlert}
          openAlerts={openAlerts}
        />
      )}
    </div>
  );
}
