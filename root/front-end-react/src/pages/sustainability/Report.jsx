import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { PATHS } from "../../routes";
import ReportDocument from "./components/ReportDocument";
import { lastFullMonth, periodName } from "./periods";
import sustLayoutCss from "./sustainability.css?inline";
import "./report.css";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const QUARTERS = [
  { value: "Q1", label: "Q1 (January to March)" },
  { value: "Q2", label: "Q2 (April to June)" },
  { value: "Q3", label: "Q3 (July to September)" },
  { value: "Q4", label: "Q4 (October to December)" },
];

/**
 * Defaults from today's date: the last full month; the last complete quarter;
 * year to date for a custom range. The year list is the last full month's
 * year and the two before it.
 */
function periodDefaults(now = new Date()) {
  const last = lastFullMonth(now);
  const year = Number(last.slice(0, 4));
  const month = Number(last.slice(5, 7));
  // A quarter is complete once its last month is; otherwise use the one before.
  let q = month % 3 === 0 ? month / 3 : Math.floor(month / 3);
  let qYear = year;
  if (q === 0) {
    q = 4;
    qYear = year - 1;
  }
  return {
    last,
    year: String(year),
    month: last.slice(5, 7),
    quarter: `Q${q}`,
    quarterYear: String(qYear),
    customFrom: `${year}-01`,
    customTo: last,
    years: [0, 1, 2].map((back) => String(year - back)),
  };
}

/** The months a choice covers, as { from, to } in "YYYY-MM". */
function rangeFor(type, { year, month, quarter, customFrom, customTo }) {
  if (type === "monthly") return { from: `${year}-${month}`, to: `${year}-${month}` };
  if (type === "quarterly") {
    const q = Number(quarter.slice(1));
    const pad = (n) => String(n).padStart(2, "0");
    return { from: `${year}-${pad(q * 3 - 2)}`, to: `${year}-${pad(q * 3)}` };
  }
  if (type === "yearly") return { from: `${year}-01`, to: `${year}-12` };
  return { from: customFrom, to: customTo };
}

export default function SustainabilityReport() {
  const [defaults] = useState(periodDefaults);
  const [type, setType] = useState("monthly");
  const [year, setYear] = useState(defaults.year);
  const [month, setMonth] = useState(defaults.month);
  const [quarter, setQuarter] = useState(defaults.quarter);
  const [customFrom, setCustomFrom] = useState(defaults.customFrom);
  const [customTo, setCustomTo] = useState(defaults.customTo);

  const [preview, setPreview] = useState(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const sheetRef = useRef(null);

  // Any change to the period discards the current preview, so the sheet (and
  // what would be saved) always matches the selection on the left.
  const change = (setter) => (e) => {
    setter(e.target.value);
    setPreview(null);
    setError(null);
    setSaved(null);
  };

  const changeType = (e) => {
    const next = e.target.value;
    setType(next);
    // A quarter defaults to the last complete one, which can be last year's.
    if (next === "quarterly") setYear(defaults.quarterYear);
    setPreview(null);
    setError(null);
    setSaved(null);
  };

  const range = rangeFor(type, { year, month, quarter, customFrom, customTo });
  const label = type === "quarterly" ? `${quarter} ${year}` : periodName(range.from, range.to);
  const incomplete = range.to > defaults.last;

  const handleBuild = async (e) => {
    e.preventDefault();
    setError(null);
    setSaved(null);
    if (type === "custom" && (!customFrom || !customTo)) {
      setError("Choose both a start and an end month.");
      return;
    }
    if (range.from > range.to) {
      setError("The start month must be before the end month.");
      return;
    }
    setIsBuilding(true);
    try {
      const res = await api.post("/sustainability-reports/generate", {
        period: label,
        from: range.from,
        to: range.to,
        title: `Sustainability report: ${label}`,
      });
      setPreview(res);
      // On small screens the report is below the form; bring it into view.
      if (window.matchMedia("(max-width: 900px)").matches) {
        requestAnimationFrame(() => sheetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    } catch (err) {
      setError(err.message || "The report could not be built. Try again.");
    } finally {
      setIsBuilding(false);
    }
  };

  // Only the period is sent: the server rebuilds the report from the same
  // readings and records who saved it, so the saved copy matches this one.
  const handleSave = async () => {
    if (!preview) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await api.post("/sustainability-reports", {
        title: preview.title,
        period: preview.period,
        from: preview.from,
        to: preview.to,
      });
      setSaved(res || { title: preview.title });
      setPreview(null);
    } catch (err) {
      setError(`Not saved: ${err.message || "the server did not respond"}. Try again.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    const original = document.title;
    document.title = `Sustainability report - ${label}`;
    window.print();
    document.title = original;
  };

  const startOver = () => {
    setPreview(null);
    setSaved(null);
    setError(null);
  };

  return (
    <div className="sustainability-report-page rpt">
      <style>{sustLayoutCss}</style>

      <header className="rpt__head">
        <h1>Reports</h1>
        <p>Build a report for any period from meter readings, check it, then save it to Archives.</p>
      </header>

      <div className="rpt__grid">
        <form className="rpt__panel" onSubmit={handleBuild} noValidate>
          <h2>Period</h2>

          <div className="rpt__field">
            <label htmlFor="selectReportType">Report covers</label>
            <select id="selectReportType" value={type} onChange={changeType}>
              <option value="monthly">One month</option>
              <option value="quarterly">A quarter</option>
              <option value="yearly">A calendar year</option>
              <option value="custom">A range of months</option>
            </select>
          </div>

          {type !== "custom" && (
            <div className="rpt__field">
              <label htmlFor="selectYear">Year</label>
              <select id="selectYear" value={year} onChange={change(setYear)}>
                {defaults.years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === "monthly" && (
            <div className="rpt__field">
              <label htmlFor="selectMonth">Month</label>
              <select id="selectMonth" value={month} onChange={change(setMonth)}>
                {MONTHS.map((name, i) => {
                  const value = String(i + 1).padStart(2, "0");
                  const future = `${year}-${value}` > defaults.last;
                  return (
                    <option key={value} value={value} disabled={future}>
                      {name}
                      {future ? " (not finished)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {type === "quarterly" && (
            <div className="rpt__field">
              <label htmlFor="selectQuarter">Quarter</label>
              <select id="selectQuarter" value={quarter} onChange={change(setQuarter)}>
                {QUARTERS.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === "custom" && (
            <div className="rpt__pair">
              <div className="rpt__field">
                <label htmlFor="inputFromDate">From</label>
                <input id="inputFromDate" type="month" value={customFrom} max={defaults.last} onChange={change(setCustomFrom)} />
              </div>
              <div className="rpt__field">
                <label htmlFor="inputToDate">To</label>
                <input id="inputToDate" type="month" value={customTo} max={defaults.last} onChange={change(setCustomTo)} />
              </div>
            </div>
          )}

          {incomplete && !error && (
            <p className="rpt__hint">
              This period includes months that have not finished, so its totals will be partial.
            </p>
          )}

          {error && (
            <p className="rpt__error" role="alert">
              {error}
            </p>
          )}

          <div className="rpt__actions">
            {!preview ? (
              <button type="submit" id="btnCompileReport" className="rpt__btn rpt__btn--primary" disabled={isBuilding}>
                {isBuilding ? "Building…" : "Build report"}
              </button>
            ) : (
              <>
                <button type="button" id="btnSaveReport" className="rpt__btn rpt__btn--primary" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save to Archives"}
                </button>
                <button type="button" id="btnExportPdf" className="rpt__btn" onClick={handlePrint}>
                  Print or save as PDF
                </button>
                <button type="button" className="rpt__btn rpt__btn--link" onClick={startOver}>
                  Start over
                </button>
              </>
            )}
          </div>

          {saved && (
            <p className="rpt__saved" role="status">
              Saved to Archives as a draft. Submit it for approval there.{" "}
              <Link to={`${PATHS.sustainability.archives}?tab=reports`}>Open Archives</Link>
            </p>
          )}
        </form>

        <div id="reportSheet" className="rpt__sheet" ref={sheetRef} aria-live="polite" aria-busy={isBuilding}>
          {preview ? (
            <ReportDocument report={preview} status="preview" />
          ) : (
            <div className="rpt__empty">
              {isBuilding ? (
                <p>Building the report for {label}…</p>
              ) : (
                <>
                  <p className="rpt__empty-title">No report yet</p>
                  <p>Choose a period and select Build report. You can check the report before saving it.</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
