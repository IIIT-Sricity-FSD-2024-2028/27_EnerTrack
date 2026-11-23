import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { PATHS } from "../../routes";
import { useAuth } from "../../auth/useAuth";
import Toast from "./components/Toast";
import MetricCard from "./components/MetricCard";
import { addMonths, rangeLabel } from "./periods";
import WastageAuditQueue from "./audit/WastageAuditQueue";
import overviewCss from "./overview.css?inline";
import sustLayoutCss from "./sustainability.css?inline";

const ICON_PROPS = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 };

export default function SustainabilityOverview() {
  const { user } = useAuth();

  const [summary, setSummary] = useState(null);
  const [targets, setTargets] = useState({});
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

    Promise.allSettled([api.get("/sustainability-metrics/summary"), api.get("/initiatives"), api.get("/targets")])
      .then(([summaryRes, initsRes, targetsRes]) => {
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
        // Active, campus-wide targets, by metric, for the card footers.
        if (targetsRes.status === "fulfilled" && Array.isArray(targetsRes.value)) {
          setTargets(
            Object.fromEntries(
              targetsRes.value
                .filter((t) => t.status === "active" && t.building_ids.length === 0)
                .map((t) => [t.metric, t]),
            ),
          );
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
  // Same number formats as Monitoring: one decimal for MWh and tonnes.
  const show = (n, digits = 0) =>
    loading
      ? "…"
      : totals
        ? Number(n ?? 0).toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })
        : "—";
  const bigEnergy = (totals?.energy_mwh ?? 0) >= 1000;
  const factors = summary?.emission_factors;

  /** "Target −10% vs 2025 by Dec 2026 · on track (−10.4%)", or nothing. */
  const targetLine = (metric) => {
    const t = targets[metric];
    if (!t) return null;
    const p = t.progress || {};
    const by = new Date(`${t.deadline}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    const base = t.baseline_from.slice(0, 4) === t.baseline_to.slice(0, 4) ? t.baseline_from.slice(0, 4) : `${t.baseline_from}–${t.baseline_to}`;
    const state =
      p.on_track == null
        ? "not measured yet"
        : `${p.on_track ? "on track" : "behind"} (${p.achieved_reduction_pct > 0 ? "−" : "+"}${Math.abs(p.achieved_reduction_pct)}% so far)`;
    return (
      <Link to={PATHS.sustainability.targets} className="so-target-line">
        Target −{t.reduction_pct}% vs {base} by {by} · {state}
      </Link>
    );
  };

  // Say which months the cards cover and what the deltas compare against,
  // straight from the server's answer rather than from a literal.
  let periodNote = "Campus totals for the reporting period";
  if (summary?.from && summary?.to) {
    const months = summary.series?.length || 1;
    const prevFrom = addMonths(summary.from, -months);
    const prevTo = addMonths(summary.from, -1);
    periodNote = `Campus totals for ${rangeLabel(summary.from, summary.to)}${
      change ? `, compared with ${rangeLabel(prevFrom, prevTo)}` : ""
    }`;
  }

  return (
    <div className="sustainability-overview-page" style={{ width: "100%" }}>
      <style>{overviewCss}</style>
      <style>{sustLayoutCss}</style>

      <Toast toast={toast} onClose={closeToast} />

      <header className="so-header">
        <div>
          <h1 id="welcomeHeading">{firstName ? `Welcome back, ${firstName}` : "Overview"}</h1>
          <p>{periodNote}, and the wastage reports waiting on you.</p>
        </div>
        <div className="so-header-controls">
          {lastUpdated && (
            <span className="so-updated">
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button type="button" className="so-btn so-btn-refresh" onClick={handleRefresh} disabled={loading}>
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
            {loading ? "Refreshing…" : "Refresh"}
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
          value={bigEnergy ? show((totals?.energy_mwh ?? 0) / 1000, 2) : show(totals?.energy_mwh, 1)}
          unit={bigEnergy ? "GWh" : "MWh"}
          delta={change ? change.energy_pct : null}
          description="Grid electricity used."
          footer={targetLine("energy_kwh")}
          icon={
            <svg {...ICON_PROPS}>
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          }
        />
        <MetricCard
          id="val-water"
          title="Water"
          value={show(totals?.water_kl)}
          unit="kL"
          delta={change ? change.water_pct : null}
          description="Metered water intake."
          footer={targetLine("water_kl")}
          icon={
            <svg {...ICON_PROPS}>
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          }
        />
        <MetricCard
          id="val-emissions"
          title="Emissions"
          value={show(totals?.emissions_t, 1)}
          unit="t CO₂e"
          delta={change ? change.emissions_pct : null}
          description={
            factors
              ? `Gas at ${factors.gas_kg_per_m3} kg/m³ (Scope 1) + electricity at ${factors.grid_kg_per_kwh} kg/kWh (Scope 2).`
              : "Gas (Scope 1) + grid electricity (Scope 2)."
          }
          footer={targetLine("emissions_kg")}
          icon={
            <svg {...ICON_PROPS}>
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
          }
        />
        <MetricCard
          id="val-food-wastage"
          title="Food waste"
          value={show(totals?.food_kg)}
          unit="kg"
          delta={change ? change.food_pct : null}
          description="Bin weights and wastage reports."
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
