import { useState, useEffect, useCallback } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import Toast from "./components/Toast";
import MetricCard from "./components/MetricCard";
import WastageAuditQueue from "./audit/WastageAuditQueue";
import overviewCss from "./overview.css?inline";
import sustLayoutCss from "./sustainability.css?inline";

const ICON_PROPS = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 };

export default function SustainabilityOverview() {
  const { user } = useAuth();

  const [summary, setSummary] = useState(null);
  const [activeInitiatives, setActiveInitiatives] = useState(null);
  const [queueReloadKey, setQueueReloadKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);

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

    Promise.allSettled([api.get("/sustainability-metrics/summary"), api.get("/initiatives")])
      .then(([summaryRes, initsRes]) => {
        if (!active) return;

        if (summaryRes.status === "rejected") {
          setError(summaryRes.reason?.message || "The metrics service did not respond.");
          setSummary(null);
        } else {
          setSummary(summaryRes.value || null);
          setError(null);
        }

        // Active means not completed and not rejected
        if (initsRes.status === "fulfilled" && Array.isArray(initsRes.value)) {
          setActiveInitiatives(initsRes.value.filter((i) => i.status !== "completed" && i.status !== "rejected").length);
        } else {
          setActiveInitiatives(null);
        }
        setLastUpdated(new Date());
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const cleanup = loadData();
    return cleanup;
  }, [loadData]);

  const handleRefresh = () => {
    setLoading(true);
    loadData();
    setQueueReloadKey((k) => k + 1);
  };

  const firstName = (user?.name || "").trim().split(/\s+/)[0];
  const totals = summary?.totals;
  const change = summary?.change?.has_comparison ? summary.change : null;
  const show = (n) => (loading ? "…" : totals ? Number(n ?? 0).toLocaleString() : "—");
  const bigEnergy = (totals?.energy_mwh ?? 0) >= 1000;

  return (
    <div className="sustainability-overview-page" style={{ width: "100%" }}>
      <style>{overviewCss}</style>
      <style>{sustLayoutCss}</style>

      <Toast toast={toast} onClose={closeToast} />

      <header className="so-header">
        <div>
          <h1 id="welcomeHeading">{firstName ? `Welcome back, ${firstName}` : "Overview"}</h1>
          <p>Campus totals for the reporting period, and the wastage reports waiting on you.</p>
        </div>
        <div className="so-header-controls">
          {lastUpdated && (
            <span className="so-updated">
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button type="button" className="so-btn primary so-btn-refresh" onClick={handleRefresh} disabled={loading}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ animation: loading ? "so-spin 1s linear infinite" : "none" }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {loading ? "Refreshing…" : "Refresh data"}
          </button>
        </div>
      </header>

      {error && !loading && (
        <div
          role="alert"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "14px 20px",
            borderRadius: "8px",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            fontSize: "14px",
          }}
        >
          <div>
            <strong>Campus totals could not be loaded.</strong> {error} Wastage reports below are unaffected.
          </div>
          <button type="button" className="so-btn danger" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      )}

      <section className="so-metrics" aria-label="Campus totals">
        <MetricCard
          id="val-energy"
          title="Energy"
          value={!loading && totals && bigEnergy ? (totals.energy_mwh / 1000).toFixed(2) : show(totals?.energy_mwh)}
          unit={bigEnergy ? "GWh" : "MWh"}
          delta={change ? change.energy_pct : null}
          description="Electricity across all live meters."
          icon={
            <svg {...ICON_PROPS}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          }
        />
        <MetricCard
          id="val-water"
          title="Water"
          value={show(totals?.water_ml)}
          unit="ML"
          delta={change ? change.water_pct : null}
          description="Metered intake across facilities."
          icon={
            <svg {...ICON_PROPS}>
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          }
        />
        <MetricCard
          id="val-emissions"
          title="Emissions"
          value={show(totals?.emissions_t)}
          unit="tCO₂e"
          delta={change ? change.emissions_pct : null}
          description="Grid electricity at 0.82 kg CO₂/kWh."
          icon={
            <svg {...ICON_PROPS}>
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
          }
        />
        <MetricCard
          id="val-food-wastage"
          title="Food wastage"
          value={show(totals?.food_kg)}
          unit="kg"
          delta={change ? change.food_pct : null}
          description="Bin weights and canteen logs."
          icon={
            <svg {...ICON_PROPS}>
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
            </svg>
          }
        />
        <MetricCard
          id="val-initiatives"
          title="Active initiatives"
          value={loading ? "…" : activeInitiatives ?? "—"}
          description="Proposed, approved or in progress."
          icon={
            <svg {...ICON_PROPS}>
              <line x1="9" y1="18" x2="15" y2="18" />
              <line x1="10" y1="22" x2="14" y2="22" />
              <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
            </svg>
          }
        />
      </section>

      <WastageAuditQueue reloadKey={queueReloadKey} showToast={showToast} />
    </div>
  );
}
