/**
 * Overview — /sustainability/overview, the Sustainability Officer's home page.
 *
 * How is campus doing? One summary panel: energy, water, emissions and
 * food waste, each with its change on the previous period and its
 * campus-wide target. How each figure is measured sits in a fold below.
 * Waste signals and wastage cases have their own page (Wastage.jsx).
 */
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { PATHS } from "../../routes";
import { addMonths, rangeLabel } from "./periods";
import overviewCss from "./overview.css?inline";
import sustLayoutCss from "./sustainability.css?inline";

export default function SustainabilityOverview() {
  const [summary, setSummary] = useState(null);
  const [targets, setTargets] = useState({});
  const [activeInitiatives, setActiveInitiatives] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        // Active, campus-wide targets, by metric.
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
  };

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

  // Which months the figures cover and what the changes compare against,
  // straight from the server's answer rather than from a literal.
  let period = "Campus totals for the reporting period";
  let previous = "the previous period";
  if (summary?.from && summary?.to) {
    const months = summary.series?.length || 1;
    previous = rangeLabel(addMonths(summary.from, -months), addMonths(summary.from, -1));
    period = `Campus totals for ${rangeLabel(summary.from, summary.to)}${change ? `, compared with ${previous}` : ""}`;
  }

  const stats = [
    {
      id: "val-energy",
      label: "Energy",
      value: bigEnergy ? show((totals?.energy_mwh ?? 0) / 1000, 2) : show(totals?.energy_mwh, 1),
      unit: bigEnergy ? "GWh" : "MWh",
      delta: change?.energy_pct,
      target: "energy_kwh",
    },
    { id: "val-water", label: "Water", value: show(totals?.water_kl), unit: "kL", delta: change?.water_pct, target: "water_kl" },
    {
      id: "val-emissions",
      label: "Emissions",
      value: show(totals?.emissions_t, 1),
      unit: "t CO₂e",
      delta: change?.emissions_pct,
      target: "emissions_kg",
    },
    { id: "val-food-wastage", label: "Food waste", value: show(totals?.food_kg), unit: "kg", delta: change?.food_pct, target: null },
  ];

  return (
    <div className="sustainability-overview-page" style={{ width: "100%" }}>
      <style>{overviewCss}</style>
      <style>{sustLayoutCss}</style>


      <header className="so-header">
        <div>
          <h1 id="welcomeHeading">Overview</h1>
          <p>
            {period}
            {activeInitiatives != null && (
              <>
                {" · "}
                <Link to={PATHS.sustainability.initiatives} id="val-initiatives">
                  {activeInitiatives} active initiative{activeInitiatives === 1 ? "" : "s"}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="so-header-controls">
          {lastUpdated && (
            <span className="so-updated">
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button type="button" className="so-btn so-btn-refresh" onClick={handleRefresh} disabled={loading}>
            <svg
              width="14"
              height="14"
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
        <div className="so-alert" role="alert">
          <div>
            <strong>Campus totals could not be loaded.</strong> {error}
          </div>
          <button type="button" className="so-btn" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      )}

      <section className="so-summary" aria-label="Campus totals">
        <div className="so-stats">
          {stats.map((s) => (
            <div className="so-stat" key={s.id}>
              <p className="so-stat-label">{s.label}</p>
              <p className="so-stat-value">
                <span id={s.id}>{s.value}</span> <small>{s.unit}</small>
              </p>
              <Change pct={s.delta} previous={previous} loading={loading} />
              <TargetLine metric={s.target} target={s.target ? targets[s.target] : null} label={s.label} />
            </div>
          ))}
        </div>

        <details className="so-how">
          <summary>How these are measured</summary>
          <ul>
            <li>
              <strong>Energy:</strong> grid electricity used.
            </li>
            <li>
              <strong>Water:</strong> metered water intake.
            </li>
            <li>
              <strong>Emissions:</strong>{" "}
              {factors
                ? `gas at ${factors.gas_kg_per_m3} kg/m³ (Scope 1) + electricity at ${factors.grid_kg_per_kwh} kg/kWh (Scope 2).`
                : "gas (Scope 1) + grid electricity (Scope 2)."}
            </li>
            <li>
              <strong>Food waste:</strong> food-waste bins weighed by General Maintenance.
            </li>
          </ul>
        </details>
      </section>

    </div>
  );
}

/** "↓ 9.9% vs Mar–Dec 2025". All four figures are better when lower. */
function Change({ pct, previous, loading }) {
  if (loading) return <p className="so-stat-change">&nbsp;</p>;
  if (typeof pct !== "number") return <p className="so-stat-change">No earlier period to compare</p>;
  const dir = pct < 0 ? "down" : pct > 0 ? "up" : "flat";
  const arrow = pct < 0 ? "↓" : pct > 0 ? "↑" : "→";
  return (
    <p className="so-stat-change">
      <span
        className={`so-delta so-delta--${dir}`}
        aria-label={`${dir === "down" ? "Down" : dir === "up" ? "Up" : "No change,"} ${Math.abs(pct)}%`}
      >
        {arrow} {Math.abs(pct)}%
      </span>{" "}
      vs {previous}
    </p>
  );
}

/** The campus-wide target for this figure, or why there is none. */
function TargetLine({ metric, target, label }) {
  if (!metric) return <p className="so-stat-target is-muted">Targets don&apos;t cover {label.toLowerCase()}</p>;
  if (!target) {
    return (
      <Link to={PATHS.sustainability.targets} className="so-stat-target is-muted">
        No active campus target
      </Link>
    );
  }
  const p = target.progress || {};
  const by = new Date(`${target.deadline}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const base =
    target.baseline_from.slice(0, 4) === target.baseline_to.slice(0, 4)
      ? target.baseline_from.slice(0, 4)
      : `${target.baseline_from}–${target.baseline_to}`;
  const tone = p.on_track == null ? "none" : p.on_track ? "good" : "warn";
  const state =
    p.on_track == null
      ? "Not measured yet"
      : `${p.on_track ? "On track" : "Behind"}, ${p.achieved_reduction_pct > 0 ? "−" : "+"}${Math.abs(p.achieved_reduction_pct)}% so far`;
  return (
    <Link to={PATHS.sustainability.targets} className="so-stat-target">
      <span>
        Target −{target.reduction_pct}% vs {base} by {by}
      </span>
      <span className={`so-dot so-dot--${tone}`}>{state}</span>
    </Link>
  );
}
