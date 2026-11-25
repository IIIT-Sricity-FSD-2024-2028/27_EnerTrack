/**
 * Overview — /sustainability/overview, the Sustainability Officer's home page.
 *
 * Three questions, top to bottom:
 *   1. How is campus doing?  Energy, water, emissions and food waste, each
 *      with its change on the previous period, a month-by-month trend line
 *      and its campus-wide target. How each is measured sits in a fold.
 *   2. What needs me?        Counts that link to the page where the work is
 *      (waste hotspots and cases on Wastage, initiatives awaiting approval).
 *   3. Are we getting there? Campus targets with their progress, and the
 *      initiatives under way with what they have saved so far.
 * The full waste panels live on their own page (Wastage.jsx).
 */
import { useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchInitiatives,
  selectActiveInitiatives,
  selectBoardInitiatives,
  selectInitiativesStatus,
} from "../../store/slices/initiativesSlice";
import {
  fetchMetricsSummary,
  selectMetricsSummary,
  selectMetricsSummaryStatus,
} from "../../store/slices/sustainabilityMetricsSlice";
import {
  fetchTargets,
  selectAllTargets,
  selectTargetsStatus,
} from "../../store/slices/targetsSlice";
import {
  fetchWastageReports,
  fetchWastageSignals,
  selectAllWastageReports,
  selectWastageReportsStatus,
  selectWastageSignals,
} from "../../store/slices/wastageReportsSlice";
import { PATHS } from "../../routes";
import { useAuth } from "../../auth/useAuth";
import { addMonths, rangeLabel } from "./periods";
import { normalizeStatus } from "./audit/auditShared";
import overviewCss from "./overview.css?inline";
import sustLayoutCss from "./sustainability.css?inline";

export default function SustainabilityOverview() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const summary = useSelector(selectMetricsSummary);
  const summaryLoad = useSelector(selectMetricsSummaryStatus);
  const boardInitiatives = useSelector(selectBoardInitiatives);
  const activeCount = useSelector(selectActiveInitiatives).length;
  const initiativesStatus = useSelector(selectInitiativesStatus);
  const targetRows = useSelector(selectAllTargets);
  const targetsStatus = useSelector(selectTargetsStatus);
  const caseRows = useSelector(selectAllWastageReports);
  const casesStatus = useSelector(selectWastageReportsStatus);
  const signals = useSelector(selectWastageSignals);

  const initiatives = initiativesStatus === "succeeded" ? boardInitiatives : null;
  const cases = casesStatus === "succeeded" ? caseRows : null;
  const targetList = targetsStatus === "succeeded"
    ? targetRows.filter((t) => t.status === "active" && t.building_ids.length === 0)
    : null;
  const targets = Object.fromEntries((targetList || []).map((t) => [t.metric, t]));
  const loading = summaryLoad.status === "idle" || summaryLoad.status === "loading" || summaryLoad.refreshing;
  const error = summaryLoad.error;
  const lastUpdated = summaryLoad.updatedAt ? new Date(summaryLoad.updatedAt) : null;

  // Each card can render its own data when a different request fails.
  const loadData = useCallback((force = false) => {
    dispatch(fetchMetricsSummary({ force }));
    dispatch(fetchInitiatives({ force }));
    dispatch(fetchTargets({ force }));
    // Wastage actions on the audit page still write directly to the backend.
    dispatch(fetchWastageSignals({ force: true }));
    dispatch(fetchWastageReports({ force: true }));
  }, [dispatch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => loadData(true);

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
  const series = summary?.series || [];
  const firstName = (user?.name || "").trim().split(/\s+/)[0];
  const activeInitiatives = initiatives ? activeCount : null;

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
      field: "energy_mwh",
    },
    { id: "val-water", label: "Water", value: show(totals?.water_kl), unit: "kL", delta: change?.water_pct, target: "water_kl", field: "water_kl" },
    {
      id: "val-emissions",
      label: "Emissions",
      value: show(totals?.emissions_t, 1),
      unit: "t CO₂e",
      delta: change?.emissions_pct,
      target: "emissions_kg",
      field: "emissions_t",
    },
    { id: "val-food-wastage", label: "Food waste", value: show(totals?.food_kg), unit: "kg", delta: change?.food_pct, target: null, field: "food_kg" },
  ];

  return (
    <div className="sustainability-overview-page" style={{ width: "100%" }}>
      <style>{overviewCss}</style>
      <style>{sustLayoutCss}</style>


      <header className="so-header">
        <div>
          <h1 id="welcomeHeading">{firstName ? `Welcome back, ${firstName}` : "Overview"}</h1>
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
              <Sparkline series={series} field={s.field} label={s.label} />
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

      <div className="so-grid">
        <AttentionCard signals={signals} cases={cases} initiatives={initiatives} loading={loading} />
        <TargetsCard targets={targetList} loading={loading} />
      </div>
      <InitiativesCard initiatives={initiatives} loading={loading} />
    </div>
  );
}

/**
 * The figure month by month across the period, as a small line: enough to
 * see the direction and the peaks. The last month is marked.
 */
function Sparkline({ series, field, label }) {
  const values = series.map((m) => Number(m[field] || 0));
  if (values.length < 2 || values.every((v) => v === 0)) return <div className="so-spark is-empty" aria-hidden="true" />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const W = 100;
  const H = 32;
  const x = (i) => (i / (values.length - 1)) * W;
  const y = (v) => H - 3 - ((v - min) / span) * (H - 6);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const first = series[0]?.label;
  const last = series[series.length - 1]?.label;
  return (
    <svg className="so-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${label}, month by month from ${first} to ${last}`}>
      <title>{`${label}: ${series.map((m) => `${m.label} ${Number(m[field] || 0).toLocaleString("en-GB")}`).join(", ")}`}</title>
      <polygon className="so-spark-area" points={`0,${H} ${points} ${W},${H}`} />
      <polyline className="so-spark-line" points={points} vectorEffect="non-scaling-stroke" />
      <circle className="so-spark-end" cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="2.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A card with a heading, an optional link to the full page, and its body. */
function Card({ title, link, linkLabel, children, className = "" }) {
  return (
    <section className={`so-card ${className}`} aria-label={title}>
      <div className="so-card-head">
        <h2>{title}</h2>
        {link && (
          <Link to={link} className="so-card-link">
            {linkLabel} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * What is waiting on the officer, as counts that link to where the work is.
 * Nothing is listed in full here; the Wastage and Initiatives pages do that.
 */
function AttentionCard({ signals, cases, initiatives, loading }) {
  if (loading && !signals && !cases) return <Card title="Needs your attention"><p className="so-card-empty">Loading…</p></Card>;

  const live = (cases || []).map((c) => ({ ...c, status: normalizeStatus(c.status) })).filter((c) => !c.details?.soArchived);
  const count = (...statuses) => live.filter((c) => statuses.includes(c.status)).length;
  const rows = [
    signals && {
      n: signals.filter((s) => s.hotspot && !s.case_id && !s.watched).length,
      one: "Waste hotspot to look at",
      many: "Waste hotspots to look at",
      to: PATHS.sustainability.wastage,
    },
    cases && { n: count("Open"), one: "Case waiting for a remedy", many: "Cases waiting for a remedy", to: PATHS.sustainability.wastage },
    cases && { n: count("Verify Target"), one: "Target to check", many: "Targets to check", to: PATHS.sustainability.wastage },
    cases && {
      n: count("Returned to SO", "Target Met", "Target Missed"),
      one: "Case ready for your next step",
      many: "Cases ready for your next step",
      to: PATHS.sustainability.wastage,
    },
    cases && {
      n: count("Forwarded to Finance", "Cost Impact Added"),
      one: "Case with Finance",
      many: "Cases with Finance",
      to: PATHS.sustainability.wastage,
      quiet: true, // waiting on someone else
    },
    initiatives && {
      n: initiatives.filter((i) => i.status === "proposed").length,
      one: "Initiative awaiting approval",
      many: "Initiatives awaiting approval",
      to: PATHS.sustainability.initiatives,
      quiet: true, // the Org Admin decides
    },
  ].filter(Boolean);

  const urgent = rows.filter((r) => !r.quiet && r.n > 0).length;
  return (
    <Card title="Needs your attention">
      {rows.length === 0 ? (
        <p className="so-card-empty">This could not be loaded. Refresh to try again.</p>
      ) : (
        <>
          {urgent === 0 && <p className="so-allclear">All clear: nothing is waiting on you.</p>}
          <ul className="so-attn">
            {rows.map((r) => (
              <li key={r.one} className={r.n === 0 ? "is-zero" : r.quiet ? "is-quiet" : "is-due"}>
                <Link to={r.to}>
                  <span className="so-attn-n">{r.n}</span>
                  <span>{r.n === 1 ? r.one : r.many}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

const TARGET_LABEL = { energy_kwh: "Energy", water_kl: "Water", emissions_kg: "Emissions", gas_m3: "Gas" };

/** Every active campus target: how far along the cut is, and whether it is on track. */
function TargetsCard({ targets, loading }) {
  return (
    <Card title="Targets" link={PATHS.sustainability.targets} linkLabel="All targets">
      {loading && !targets ? (
        <p className="so-card-empty">Loading…</p>
      ) : !targets ? (
        <p className="so-card-empty">Targets could not be loaded.</p>
      ) : targets.length === 0 ? (
        <p className="so-card-empty">
          No active campus targets. <Link to={PATHS.sustainability.targets}>Set one</Link> to track progress here.
        </p>
      ) : (
        <ul className="so-targets">
          {targets.map((t) => {
            const p = t.progress || {};
            const achieved = Number(p.achieved_reduction_pct ?? 0);
            const goal = Number(t.reduction_pct) || 0;
            const fill = goal > 0 ? Math.max(0, Math.min(100, (achieved / goal) * 100)) : 0;
            const tone = p.on_track == null ? (achieved >= goal ? "good" : "none") : p.on_track ? "good" : "warn";
            const by = new Date(`${t.deadline}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
            const state =
              p.on_track == null ? (p.months_compared ? "Not judged yet" : "Not measured yet") : p.on_track ? "On track" : "Behind";
            return (
              <li key={t.target_id}>
                <div className="so-target-row">
                  <strong>{TARGET_LABEL[t.metric] || t.metric}</strong>
                  <span>
                    −{goal}% by {by}
                  </span>
                </div>
                <div className="so-bar" role="img" aria-label={`${achieved}% cut so far of a ${goal}% target`}>
                  <span className={`so-bar-fill so-bar-fill--${tone}`} style={{ width: `${fill}%` }} />
                </div>
                <div className="so-target-row is-sub">
                  <span>
                    {achieved > 0 ? "−" : "+"}
                    {Math.abs(achieved)}% so far
                  </span>
                  <span className={`so-dot so-dot--${tone}`}>{state}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const INITIATIVE_STAGES = [
  ["proposed", "Proposed"],
  ["approved", "Approved"],
  ["in-progress", "In progress"],
  ["completed", "Completed"],
];

/** Where the initiatives stand, and what the ones under way have saved so far. */
function InitiativesCard({ initiatives, loading }) {
  const running = (initiatives || []).filter((i) => i.status === "in-progress").slice(0, 3);
  return (
    <Card title="Initiatives" link={PATHS.sustainability.initiatives} linkLabel="All initiatives" className="so-card--wide">
      {loading && !initiatives ? (
        <p className="so-card-empty">Loading…</p>
      ) : !initiatives ? (
        <p className="so-card-empty">Initiatives could not be loaded.</p>
      ) : (
        <>
          <p className="so-stages">
            {INITIATIVE_STAGES.map(([key, label]) => {
              const n = initiatives.filter((i) => i.status === key).length;
              return (
                <span key={key} className={n === 0 ? "is-zero" : undefined}>
                  <strong>{n}</strong> {label}
                </span>
              );
            })}
          </p>
          {running.length === 0 ? (
            <p className="so-card-empty">Nothing is in progress right now.</p>
          ) : (
            <ul className="so-running">
              {running.map((i) => {
                const perf = i.performance || {};
                const openJobs = (i.jobs || []).filter((j) => !j.closed_at).length;
                return (
                  <li key={i.initiative_id}>
                    <strong>{i.title}</strong>
                    <span className="so-running-meta">
                      {perf.measurable && perf.actual_saving_to_date != null ? (
                        <>
                          {Number(perf.actual_saving_to_date).toLocaleString("en-GB")} {perf.unit} saved so far
                          {perf.expected_to_date ? ` (expected ${Number(perf.expected_to_date).toLocaleString("en-GB")})` : ""}
                        </>
                      ) : (
                        perf.reason || "Savings not measured yet"
                      )}
                      {openJobs > 0 ? ` · ${openJobs} technician job${openJobs === 1 ? "" : "s"} open` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Card>
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
