/**
 * BuildingsTable — where use is concentrated and where it is rising, one row
 * per building, from summary.by_building. Rows add up to the campus totals.
 *
 * Each row links to proposing an initiative for that building, and each
 * silent or faulty meter can be reported to the technicians as an alert.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PATHS } from "../../../routes";
import "./buildings.css";

const fmt = (n, digits = 0) =>
  Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const change = (pct) => (pct === null || pct === undefined ? "—" : pct === 0 ? "0%" : `${pct > 0 ? "+" : "−"}${fmt(Math.abs(pct), 1)}%`);

const COLUMNS = [
  { key: "name", label: "Building", numeric: false },
  { key: "energy_kwh", label: "Electricity", unit: "MWh", value: (b) => b.energy_kwh / 1000, digits: 1 },
  { key: "water_kl", label: "Water", unit: "kL", value: (b) => b.water_kl },
  { key: "gas_m3", label: "Gas", unit: "m³", value: (b) => b.gas_m3 },
  { key: "emissions_kg", label: "Emissions", unit: "t CO₂e", value: (b) => b.emissions_kg / 1000, digits: 1 },
  { key: "change_pct", label: "Electricity vs previous", isChange: true },
  { key: "yoy_pct", label: "Electricity vs last year", isChange: true },
];

/** The column the selected chart metric points at. */
const SORT_FOR_METRIC = { energy: "energy_kwh", water: "water_kl", emissions: "emissions_kg", food: "energy_kwh" };

export default function BuildingsTable({ rows, metric, periodLabel, onRaiseAlert, raising, openAlerts }) {
  const [sort, setSort] = useState(null); // { key, dir } once the user picks one
  const sortKey = sort?.key ?? SORT_FOR_METRIC[metric] ?? "energy_kwh";
  const sortDir = sort?.dir ?? "desc";
  const active = { key: sortKey, dir: sortDir };

  const sorted = useMemo(() => {
    const list = [...(rows || [])];
    const key = sortKey;
    const dir = sortDir;
    list.sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      // Missing values (no comparison) always sort last.
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, sortKey, sortDir]);

  const toggle = (key) =>
    setSort((s) => ({
      key,
      dir: (s?.key ?? active.key) === key && (s?.dir ?? active.dir) === "desc" ? "asc" : "desc",
    }));

  if (!rows || rows.length === 0) return null;

  return (
    <section className="bldg" aria-labelledby="bldgHeading">
      <h2 id="bldgHeading">Buildings</h2>
      <p className="bldg__sub">
        {periodLabel}. Buildings add up to the campus totals. Electricity change compares with the previous period and with
        the same months last year.
      </p>

      <div className="bldg__scroll">
        <table className="bldg__table">
          <thead>
            <tr>
              {COLUMNS.map((c) => {
                const isSorted = active.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={c.key === "name" ? "bldg__name" : "num"}
                    aria-sort={isSorted ? (active.dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button type="button" onClick={() => toggle(c.key)}>
                      {c.label}
                      {c.unit && <span className="bldg__unit"> {c.unit}</span>}
                      <span aria-hidden="true" className="bldg__arrow">
                        {isSorted ? (active.dir === "asc" ? "▲" : "▼") : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th scope="col">Meters</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => {
              const problems = [
                ...b.silent_meters.map((m) => ({ ...m, issue: "sent no readings" })),
                ...b.faulty_meters.map((m) => ({ ...m, issue: m.status === "faulty" ? "is faulty" : "is being calibrated" })),
              ];
              return (
                <tr key={b.building_id}>
                  <th scope="row" className="bldg__name">
                    {b.name}
                  </th>
                  {COLUMNS.slice(1).map((c) => (
                    <td key={c.key} className={`num${c.isChange && b[c.key] > 0 ? " bldg__up" : ""}`}>
                      {c.isChange ? change(b[c.key]) : fmt(c.value(b), c.digits || 0)}
                    </td>
                  ))}
                  <td className="bldg__meters">
                    <span>
                      {b.meters_reporting} of {b.meters_total} reporting
                    </span>
                    {problems.map((m) => (
                      <span key={m.meter_id} className="bldg__problem">
                        {m.meter_code} {m.issue}
                        {openAlerts?.has(m.meter_id) ? (
                          <span className="bldg__alert-open">Alert open</span>
                        ) : (
                          <button
                            type="button"
                            className="bldg__alert"
                            disabled={raising === m.meter_id}
                            onClick={() => onRaiseAlert(m, b)}
                          >
                            {raising === m.meter_id ? "Raising…" : "Raise alert"}
                          </button>
                        )}
                      </span>
                    ))}
                  </td>
                  <td className="bldg__actions">
                    <Link to={`${PATHS.sustainability.initiatives}?building=${encodeURIComponent(b.building_id)}`}>
                      Propose initiative
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
