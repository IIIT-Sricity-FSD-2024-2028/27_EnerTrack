import { useState, useRef, useEffect, useCallback } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import "../../styles/sustainability_officer/sust_report.css";

const YEAR_OPTIONS = ["2026", "2025", "2024"];
const QUARTER_OPTIONS = ["Q1", "Q2", "Q3", "Q4"];
const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function SustainabilityReport() {
  const { user } = useAuth();

  // Form selections
  const [reportType, setReportType] = useState("yearly");
  const [year, setYear] = useState("2026");
  const [quarter, setQuarter] = useState("Q3");
  const [month, setMonth] = useState("September");
  const [customFrom, setCustomFrom] = useState("2025-05-01");
  const [customTo, setCustomTo] = useState("2025-05-31");

  // Dropdown open states
  const [yearOpen, setYearOpen] = useState(false);
  const [quarterOpen, setQuarterOpen] = useState(false);
  const [monthOpen, setMonthOpen] = useState(false);

  const yearRef = useRef(null);
  const quarterRef = useRef(null);
  const monthRef = useRef(null);

  // Pipeline state (0 to 4)
  const [pipelineStep, setPipelineStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (yearRef.current && !yearRef.current.contains(event.target)) {
        setYearOpen(false);
      }
      if (quarterRef.current && !quarterRef.current.contains(event.target)) {
        setQuarterOpen(false);
      }
      if (monthRef.current && !monthRef.current.contains(event.target)) {
        setMonthOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Format period label
  const getPeriodLabel = () => {
    if (reportType === "yearly") return `Year ${year}`;
    if (reportType === "quarterly") return `${quarter} ${year}`;
    if (reportType === "monthly") return `${month} ${year}`;
    return `${customFrom} to ${customTo}`;
  };

  // Run pipeline and generate report
  const handleGenerate = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setPipelineStep(1);

    const interval = setInterval(() => {
      setPipelineStep((prev) => {
        if (prev < 4) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setIsGenerating(false);

          const periodLabel = getPeriodLabel();
          setGeneratedReport({
            title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Sustainability Audit Report`,
            period: periodLabel,
            energy: "3,820 MWh",
            energyDiff: "-12.4%",
            water: "14.2 ML",
            waterDiff: "-8.1%",
            emissions: "1,140 tCO₂e",
            emissionsDiff: "-15.3%",
            wasteDiverted: "78%",
          });

          showToast("Report compiled successfully!", "success");
          return 4;
        }
      });
    }, 600);
  };

  // Archive compiled report to backend
  const handleArchive = async () => {
    if (!generatedReport) return;

    const payload = {
      title: generatedReport.title,
      period: generatedReport.period,
      metrics: {
        energy: generatedReport.energy,
        water: generatedReport.water,
        emissions: generatedReport.emissions,
      },
      generated_by_id: user?.user_id || "550e8400-0005-4000-8000-000000000005",
      generated_at: new Date().toISOString(),
    };

    try {
      await api.post("/sustainability-reports", payload);
      showToast("Report archived successfully to compliance records!");
    } catch (e) {
      console.warn("[Report] Archive fallback local:", e);
      try {
        const raw = localStorage.getItem("enertrack_universal_v1");
        const data = raw ? JSON.parse(raw) : { sust: { reports: [] } };
        if (!data.sust) data.sust = {};
        if (!data.sust.reports) data.sust.reports = [];
        data.sust.reports.push({ ...payload, id: `rep-${Date.now()}` });
        localStorage.setItem("enertrack_universal_v1", JSON.stringify(data));
      } catch (err) {
        console.warn("Local storage fallback err:", err);
      }
      showToast("Report saved to local archives.", "info");
    }

    setGeneratedReport(null);
  };

  return (
    <div className="sustainability-report-page" style={{ width: "100%" }}>
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
        <h1>Sustainability Reporting</h1>
        <p>
          Choose a reporting period, run the reporting pipeline, review the
          compiled output, handle exceptions, and export approved
          sustainability reports for stakeholders.
        </p>
      </header>

      {/* MAIN REPORT PANEL */}
      <section className="report-panel">
        {/* Report configuration */}
        <h3 className="section-title">Report configuration</h3>
        <p className="section-desc">
          Define the report type and date window before generating the
          compiled sustainability report.
        </p>

        <label className="form-label">Report type</label>
        <div className="type-pills" id="reportTypePills">
          {["yearly", "quarterly", "monthly", "custom"].map((t) => (
            <div
              key={t}
              className={`type-pill ${reportType === t ? "active" : ""}`}
              onClick={() => setReportType(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </div>
          ))}
        </div>

        {/* Dynamic Form Grid */}
        <div className="form-grid">
          {/* YEAR DROPDOWN */}
          {(reportType === "yearly" ||
            reportType === "quarterly" ||
            reportType === "monthly") && (
              <div className="input-group" id="groupYear" ref={yearRef}>
                <label className="form-label" htmlFor="yearSelect">Year</label>
                <div className={`custom-select ${yearOpen ? "open" : ""}`} data-select>
                  <button
                    type="button"
                    className="select-trigger"
                    id="yearSelect"
                    aria-expanded={yearOpen}
                    onClick={() => setYearOpen(!yearOpen)}
                  >
                    <span className="select-value">{year}</span>
                    <span className="select-chevron" aria-hidden="true">⌄</span>
                  </button>
                  <div className="select-menu">
                    {YEAR_OPTIONS.map((y) => (
                      <button
                        key={y}
                        type="button"
                        className={`select-option ${year === y ? "selected" : ""}`}
                        onClick={() => {
                          setYear(y);
                          setYearOpen(false);
                        }}
                      >
                        <span>{y}</span>
                        <span className="checkmark">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          {/* QUARTER DROPDOWN */}
          {reportType === "quarterly" && (
            <div className="input-group" id="groupQuarter" ref={quarterRef}>
              <label className="form-label" htmlFor="quarterSelect">Quarter</label>
              <div className={`custom-select ${quarterOpen ? "open" : ""}`} data-select>
                <button
                  type="button"
                  className="select-trigger"
                  id="quarterSelect"
                  aria-expanded={quarterOpen}
                  onClick={() => setQuarterOpen(!quarterOpen)}
                >
                  <span className="select-value">{quarter}</span>
                  <span className="select-chevron" aria-hidden="true">⌄</span>
                </button>
                <div className="select-menu">
                  {QUARTER_OPTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      className={`select-option ${quarter === q ? "selected" : ""}`}
                      onClick={() => {
                        setQuarter(q);
                        setQuarterOpen(false);
                      }}
                    >
                      <span>{q}</span>
                      <span className="checkmark">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MONTH DROPDOWN */}
          {reportType === "monthly" && (
            <div className="input-group" id="groupMonth" ref={monthRef}>
              <label className="form-label" htmlFor="monthSelect">Month</label>
              <div className={`custom-select ${monthOpen ? "open" : ""}`} data-select>
                <button
                  type="button"
                  className="select-trigger"
                  id="monthSelect"
                  aria-expanded={monthOpen}
                  onClick={() => setMonthOpen(!monthOpen)}
                >
                  <span className="select-value">{month}</span>
                  <span className="select-chevron" aria-hidden="true">⌄</span>
                </button>
                <div className="select-menu">
                  {MONTH_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`select-option ${month === m ? "selected" : ""}`}
                      onClick={() => {
                        setMonth(m);
                        setMonthOpen(false);
                      }}
                    >
                      <span>{m}</span>
                      <span className="checkmark">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CUSTOM FROM & TO */}
          {reportType === "custom" && (
            <>
              <div className="input-group" id="groupCustomFrom">
                <label className="form-label" htmlFor="customDateFrom">From</label>
                <input
                  type="date"
                  id="customDateFrom"
                  className="form-input"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="input-group" id="groupCustomTo">
                <label className="form-label" htmlFor="customDateTo">To</label>
                <input
                  type="date"
                  id="customDateTo"
                  className="form-input"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <div className="divider" />

        {/* Reporting pipeline */}
        <h3 className="section-title">Reporting pipeline</h3>
        <p className="section-desc">
          Progress from source retrieval to final report compilation.
        </p>

        <div className="pipeline-section">
          <div className="pipeline-progress">
            <div className="pipeline-line" />
            <div
              className="pipeline-line-fill"
              style={{
                width:
                  pipelineStep === 0
                    ? "0%"
                    : `${((pipelineStep - 1) / 3) * 100}%`,
              }}
            />
          </div>

          <div className="pipeline-track">
            {/* Step 1: Retrieve Data */}
            <div className={`pipeline-step ${pipelineStep >= 1 ? "active" : ""}`}>
              <div className={`pipeline-circle ${pipelineStep >= 1 ? "active" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pipelineStep >= 1 ? "#fff" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
              </div>
              <h4>Retrieve Data</h4>
            </div>

            {/* Step 2: Generate Summary Text */}
            <div className={`pipeline-step ${pipelineStep >= 2 ? "active" : ""}`}>
              <div className={`pipeline-circle ${pipelineStep >= 2 ? "active" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pipelineStep >= 2 ? "#fff" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h4>Generate Summary Text</h4>
            </div>

            {/* Step 3: Generate KPIs & Outlines */}
            <div className={`pipeline-step ${pipelineStep >= 3 ? "active" : ""}`}>
              <div className={`pipeline-circle ${pipelineStep >= 3 ? "active" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pipelineStep >= 3 ? "#fff" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h4>Generate KPIs & Outlines</h4>
            </div>

            {/* Step 4: Compile Report */}
            <div className={`pipeline-step ${pipelineStep >= 4 ? "active" : ""}`}>
              <div className={`pipeline-circle ${pipelineStep >= 4 ? "active" : ""}`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={pipelineStep >= 4 ? "#fff" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h4>Compile Report</h4>
            </div>
          </div>
        </div>
      </section>

      {/* GENERATE BUTTON SECTION */}
      <section
        className="report-panel"
        style={{
          marginTop: "24px",
          display: "flex",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <button
          type="button"
          className="btn-block-dark"
          style={{
            maxWidth: "400px",
            width: "100%",
            background: "#111827",
            color: "#ffffff",
            padding: "14px 24px",
            borderRadius: "8px",
            fontSize: "15px",
            fontWeight: "600",
            border: "none",
            cursor: isGenerating ? "default" : "pointer",
            transition: "background 0.2s",
          }}
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? "Compiling Report..." : "Generate Report"}
        </button>
      </section>

      {/* COMPILED REPORT PREVIEW MODAL */}
      {generatedReport && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setGeneratedReport(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "28px",
              width: "100%",
              maxWidth: "600px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#111827", margin: "0 0 4px 0" }}>
                  {generatedReport.title}
                </h2>
                <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                  Validated reporting period: <strong>{generatedReport.period}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGeneratedReport(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "20px",
                  cursor: "pointer",
                  color: "#9ca3af",
                }}
              >
                &times;
              </button>
            </div>

            {/* Metrics cards inside preview */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              <div style={{ background: "#f8fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px" }}>
                <span style={{ fontSize: "12px", color: "#6b7280", display: "block" }}>Energy Baseline</span>
                <strong style={{ fontSize: "18px", color: "#111827" }}>{generatedReport.energy}</strong>
                <span style={{ fontSize: "11px", color: "#059669", display: "block", marginTop: "2px" }}>{generatedReport.energyDiff} vs last period</span>
              </div>
              <div style={{ background: "#f8fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px" }}>
                <span style={{ fontSize: "12px", color: "#6b7280", display: "block" }}>Water Consumption</span>
                <strong style={{ fontSize: "18px", color: "#111827" }}>{generatedReport.water}</strong>
                <span style={{ fontSize: "11px", color: "#059669", display: "block", marginTop: "2px" }}>{generatedReport.waterDiff} vs last period</span>
              </div>
              <div style={{ background: "#f8fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px" }}>
                <span style={{ fontSize: "12px", color: "#6b7280", display: "block" }}>Scope 1 & 2 Emissions</span>
                <strong style={{ fontSize: "18px", color: "#111827" }}>{generatedReport.emissions}</strong>
                <span style={{ fontSize: "11px", color: "#059669", display: "block", marginTop: "2px" }}>{generatedReport.emissionsDiff} carbon intensity</span>
              </div>
              <div style={{ background: "#f8fafb", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "12px" }}>
                <span style={{ fontSize: "12px", color: "#6b7280", display: "block" }}>Waste Diversion Rate</span>
                <strong style={{ fontSize: "18px", color: "#111827" }}>{generatedReport.wasteDiverted}</strong>
                <span style={{ fontSize: "11px", color: "#059669", display: "block", marginTop: "2px" }}>Audit compliant</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="btn-action"
                style={{ padding: "9px 18px", fontSize: "13px" }}
                onClick={() => setGeneratedReport(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-dark"
                style={{ padding: "9px 20px", fontSize: "13px", background: "#059669", borderColor: "#059669" }}
                onClick={handleArchive}
              >
                Archive to Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
