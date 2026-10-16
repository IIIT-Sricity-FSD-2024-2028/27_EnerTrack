import { useState, useCallback } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import Toast from "./components/Toast";
import reportCss from "../../styles/sustainability_officer/sust_report.css?inline";
import sustLayoutCss from "./sustainability.css?inline";

const MONTH_NAMES = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const QUARTERS = [
  { value: "Q1", label: "Q1 (Jan–Mar)" },
  { value: "Q2", label: "Q2 (Apr–Jun)" },
  { value: "Q3", label: "Q3 (Jul–Sep)" },
  { value: "Q4", label: "Q4 (Oct–Dec)" },
];

export default function SustainabilityReport() {
  const { user } = useAuth();

  // Period panel selections
  const [reportType, setReportType] = useState("monthly"); // "monthly" | "quarterly" | "yearly" | "custom"
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState("08");
  const [quarter, setQuarter] = useState("Q2");
  const [customFrom, setCustomFrom] = useState("2026-01");
  const [customTo, setCustomTo] = useState("2026-08");

  // State for generation, preview, archiving
  const [isCompiling, setIsCompiling] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  // Compute period string & bounds for API request
  const getPeriodPayload = useCallback(() => {
    if (reportType === "monthly") {
      const monthObj = MONTH_NAMES.find((m) => m.value === month);
      const label = monthObj ? `${monthObj.label} ${year}` : `${year}-${month}`;
      const periodStr = `${year}-${month}`;
      return { period: label, from: periodStr, to: periodStr };
    }
    if (reportType === "quarterly") {
      const qNum = Number(quarter.replace("Q", ""));
      const startMo = String((qNum - 1) * 3 + 1).padStart(2, "0");
      const endMo = String(qNum * 3).padStart(2, "0");
      return {
        period: `${quarter} ${year}`,
        from: `${year}-${startMo}`,
        to: `${year}-${endMo}`,
      };
    }
    if (reportType === "yearly") {
      return {
        period: `FY ${year}`,
        from: `${year}-01`,
        to: `${year}-12`,
      };
    }
    // Custom
    return {
      period: `${customFrom} to ${customTo}`,
      from: customFrom,
      to: customTo,
    };
  }, [reportType, year, month, quarter, customFrom, customTo]);

  // Compile report preview via backend generate endpoint
  const handleCompile = async (e) => {
    if (e) e.preventDefault();
    setValidationError(null);

    const payload = getPeriodPayload();

    if (reportType === "custom" && payload.from > payload.to) {
      setValidationError("The start date cannot be after the end date. Please select an earlier start date.");
      return;
    }

    setIsCompiling(true);
    try {
      const res = await api.post("/sustainability-reports/generate", {
        period: payload.period,
        from: payload.from,
        to: payload.to,
        title: `${payload.period} Sustainability Performance Report`,
      });
      setPreview(res);
      showToast("Report compiled. Review details before archiving.", "info");
    } catch (err) {
      const msg = err.message || "Failed to compile sustainability report preview";
      setValidationError(`${msg}. Please check the selected period bounds and retry.`);
      showToast(msg, "error");
    } finally {
      setIsCompiling(false);
    }
  };

  // Archive report to backend records
  const handleSaveReport = async () => {
    if (!preview) return;

    if (!user?.user_id) {
      showToast("Cannot archive report: user session is missing.", "error");
      return;
    }

    setIsArchiving(true);
    try {
      const reportPayload = {
        title: preview.title,
        period: preview.period,
        metrics: {
          energyReduction: preview.metrics.energyReduction,
          wasteDiverted: preview.metrics.wasteDiverted,
          carbonOffset: preview.metrics.carbonOffset,
          waterSaved: preview.metrics.waterSaved,
          energyConsumed: `${preview.totals?.energy_mwh ?? 0} MWh`,
          waterIntake: `${preview.totals?.water_ml ?? 0} ML`,
          emissionsTons: `${preview.totals?.emissions_t ?? 0} tCO₂e`,
        },
        generated_by_id: user.user_id,
        generated_at: new Date().toISOString(),
      };

      await api.post("/sustainability-reports", reportPayload);
      showToast("Report saved to Archives compliance records.", "success");
      setPreview(null);
    } catch (err) {
      const msg = err.message || "Failed to save report to backend";
      showToast(`Save failed: ${msg}. Try saving again.`, "error");
    } finally {
      setIsArchiving(false);
    }
  };

  // Export report to CSV
  const handleExportCsv = () => {
    if (!preview) return;

    const rows = [
      ["Report Title", `"${preview.title}"`],
      ["Period", `"${preview.period}"`],
      ["Compiled At", `"${preview.generated_at}"`],
      [""],
      ["Key Abatement Metric", "Value"],
      ["Energy Abatement Rate", `"${preview.metrics?.energyReduction || '-'}"`],
      ["Waste Diverted Rate", `"${preview.metrics?.wasteDiverted || '-'}"`],
      ["Carbon Avoidance", `"${preview.metrics?.carbonOffset || '-'}"`],
      ["Water Conserved", `"${preview.metrics?.waterSaved || '-'}"`],
      [""],
      ["Resource Category", "Current Consumption", "Unit", "Delta vs Prior Period"],
      ["Electricity Demand", preview.totals?.energy_mwh ?? 0, "MWh", `${preview.deltas?.energy_pct ?? 0}%`],
      ["Potable Water", preview.totals?.water_ml ?? 0, "ML", `${preview.deltas?.water_pct ?? 0}%`],
      ["Natural Gas", preview.totals?.gas_m3 ?? 0, "m³", `${preview.deltas?.gas_pct ?? 0}%`],
      ["Food Wastage", preview.totals?.food_kg ?? 0, "kg", `${preview.deltas?.food_pct ?? 0}%`],
      ["Total Carbon Footprint", preview.totals?.emissions_t ?? 0, "tCO₂e", `${preview.deltas?.emissions_pct ?? 0}%`],
    ];

    if (preview.data_gaps && preview.data_gaps.length > 0) {
      rows.push([""]);
      rows.push(["Data Gaps & Observations"]);
      preview.data_gaps.forEach((gap) => rows.push([`"${gap.replace(/"/g, '""')}"`]));
    }

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const cleanPeriod = preview.period.replace(/[^a-zA-Z0-9_-]/g, "_");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Sustainability_Report_${cleanPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV file exported successfully.", "success");
  };

  return (
    <div className="sustainability-report-page" style={{ width: "100%" }}>
      <style>{reportCss}</style>
      <style>{sustLayoutCss}</style>

      <Toast toast={toast} onClose={closeToast} />

      {/* PAGE HEADER */}
      <header className="page-header" style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", color: "#111827", margin: "0 0 6px 0" }}>
          Sustainability Reporting
        </h1>
        <p style={{ margin: 0, color: "#4b5563", fontSize: "14px" }}>
          Compile verified compliance audits, inspect data gaps honestly, and archive executive performance sheets.
        </p>
      </header>

      {/* TWO COLUMN WORKSPACE: Narrow Period Panel (Left) & Live Report Sheet (Right) */}
      <div
        style={{
          display: "flex",
          gap: "28px",
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {/* LEFT: NARROW PERIOD PANEL */}
        <aside
          style={{
            width: "300px",
            flexShrink: 0,
            background: "#ffffff",
            border: "1px solid #d8dde2",
            borderRadius: "8px",
            padding: "24px",
          }}
          aria-label="Report configuration"
        >
          <h2 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "700", color: "#111827" }}>
            Period parameters
          </h2>

          <form onSubmit={handleCompile}>
            {/* Report Granularity Type */}
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="selectReportType"
                style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}
              >
                Cadence
              </label>
              <select
                id="selectReportType"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  fontSize: "14px",
                  color: "#111827",
                }}
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom date range</option>
              </select>
            </div>

            {/* Year selection */}
            {reportType !== "custom" && (
              <div style={{ marginBottom: "16px" }}>
                <label
                  htmlFor="selectYear"
                  style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}
                >
                  Year
                </label>
                <select
                  id="selectYear"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    fontSize: "14px",
                    color: "#111827",
                  }}
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>
            )}

            {/* Month selection */}
            {reportType === "monthly" && (
              <div style={{ marginBottom: "16px" }}>
                <label
                  htmlFor="selectMonth"
                  style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}
                >
                  Month
                </label>
                <select
                  id="selectMonth"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    fontSize: "14px",
                    color: "#111827",
                  }}
                >
                  {MONTH_NAMES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quarter selection */}
            {reportType === "quarterly" && (
              <div style={{ marginBottom: "16px" }}>
                <label
                  htmlFor="selectQuarter"
                  style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}
                >
                  Quarter
                </label>
                <select
                  id="selectQuarter"
                  value={quarter}
                  onChange={(e) => setQuarter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    fontSize: "14px",
                    color: "#111827",
                  }}
                >
                  {QUARTERS.map((q) => (
                    <option key={q.value} value={q.value}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom From / To */}
            {reportType === "custom" && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ marginBottom: "12px" }}>
                  <label
                    htmlFor="inputFromDate"
                    style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}
                  >
                    Start Month (YYYY-MM)
                  </label>
                  <input
                    id="inputFromDate"
                    type="month"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="inputToDate"
                    style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}
                  >
                    End Month (YYYY-MM)
                  </label>
                  <input
                    id="inputToDate"
                    type="month"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Validation Error Message with guidance */}
            {validationError && (
              <div
                role="alert"
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  lineHeight: 1.4,
                  marginBottom: "16px",
                }}
              >
                {validationError}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
              <button
                type="submit"
                id="btnCompileReport"
                disabled={isCompiling}
                style={{
                  background: "#2d5a43",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "10px 16px",
                  fontWeight: "600",
                  fontSize: "14px",
                  cursor: isCompiling ? "default" : "pointer",
                  display: "inline-flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "8px",
                  opacity: isCompiling ? 0.75 : 1,
                }}
              >
                {isCompiling ? "Compiling telemetry..." : "Compile report"}
              </button>

              {preview && (
                <>
                  <button
                    type="button"
                    id="btnSaveReport"
                    onClick={handleSaveReport}
                    disabled={isArchiving}
                    style={{
                      background: "#ffffff",
                      color: "#2d5a43",
                      border: "1px solid #2d5a43",
                      borderRadius: "6px",
                      padding: "10px 16px",
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: isArchiving ? "default" : "pointer",
                      display: "inline-flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {isArchiving ? "Saving to archives..." : "Save report"}
                  </button>

                  <button
                    type="button"
                    id="btnExportCsv"
                    onClick={handleExportCsv}
                    style={{
                      background: "#f3f4f6",
                      color: "#374151",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      padding: "9px 16px",
                      fontWeight: "600",
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "inline-flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    Export CSV
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    style={{
                      background: "transparent",
                      color: "#6b7280",
                      border: "none",
                      padding: "6px",
                      fontSize: "12px",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Clear preview
                  </button>
                </>
              )}
            </div>
          </form>
        </aside>

        {/* RIGHT: LIVE REPORT SHEET */}
        <main
          style={{
            flex: 1,
            minWidth: "320px",
            background: "#ffffff",
            border: "1px solid #d8dde2",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            padding: "36px 40px",
            position: "relative",
          }}
          aria-live="polite"
        >
          {!preview ? (
            <div
              style={{
                textAlign: "center",
                padding: "80px 20px",
                color: "#6b7280",
              }}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="1.5"
                style={{ margin: "0 auto 16px auto", display: "block" }}
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <h3 style={{ margin: "0 0 6px 0", fontSize: "16px", color: "#111827", fontWeight: "600" }}>
                No active report preview
              </h3>
              <p style={{ margin: 0, fontSize: "14px", maxWidth: "420px", marginLeft: "auto", marginRight: "auto" }}>
                Select period parameters on the left and click <strong>Compile report</strong> to generate a verified compliance sheet.
              </p>
            </div>
          ) : (
            <div>
              {/* Executive Header */}
              <div
                style={{
                  borderBottom: "2px solid #2d5a43",
                  paddingBottom: "18px",
                  marginBottom: "28px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#2d5a43",
                      fontWeight: "700",
                      letterSpacing: "0.5px",
                    }}
                  >
                    EnerTrack Sustainability Audit
                  </span>
                  <h2
                    style={{
                      fontFamily: "'Source Serif 4', Georgia, serif",
                      fontSize: "26px",
                      fontWeight: "700",
                      color: "#111827",
                      margin: "4px 0 0 0",
                    }}
                  >
                    {preview.title}
                  </h2>
                </div>

                <div style={{ textAlign: "right", fontSize: "12px", color: "#6b7280" }}>
                  <div>
                    Period: <strong style={{ color: "#111827" }}>{preview.period}</strong>
                  </div>
                  <div style={{ marginTop: "2px", fontVariantNumeric: "tabular-nums" }}>
                    Compiled on {new Date(preview.generated_at).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}
                  </div>
                </div>
              </div>

              {/* EXECUTIVE ABATEMENT LEDGER (No identical stat cards, real ledger table) */}
              <section style={{ marginBottom: "32px" }}>
                <h3
                  style={{
                    fontFamily: "'Source Serif 4', Georgia, serif",
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#111827",
                    marginBottom: "14px",
                  }}
                >
                  Executive performance summary
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "16px",
                    background: "#f9fafb",
                    padding: "18px 22px",
                    borderRadius: "6px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Energy Abatement</span>
                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: "700",
                        color: "#166534",
                        fontVariantNumeric: "tabular-nums",
                        marginTop: "4px",
                      }}
                    >
                      {preview.metrics?.energyReduction || "-"}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Waste Diverted</span>
                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: "700",
                        color: "#1e40af",
                        fontVariantNumeric: "tabular-nums",
                        marginTop: "4px",
                      }}
                    >
                      {preview.metrics?.wasteDiverted || "-"}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Carbon Avoidance</span>
                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: "700",
                        color: "#6b21a8",
                        fontVariantNumeric: "tabular-nums",
                        marginTop: "4px",
                      }}
                    >
                      {preview.metrics?.carbonOffset || "-"}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>Water Conserved</span>
                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: "700",
                        color: "#0f766e",
                        fontVariantNumeric: "tabular-nums",
                        marginTop: "4px",
                      }}
                    >
                      {preview.metrics?.waterSaved || "-"}
                    </div>
                  </div>
                </div>
              </section>

              {/* DETAILED RESOURCE INVENTORY TABLE */}
              <section style={{ marginBottom: "32px" }}>
                <h3
                  style={{
                    fontFamily: "'Source Serif 4', Georgia, serif",
                    fontSize: "18px",
                    fontWeight: "600",
                    color: "#111827",
                    marginBottom: "12px",
                  }}
                >
                  Resource accounting breakdown
                </h3>

                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "13px",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e5e7eb", color: "#374151" }}>
                        <th style={{ padding: "10px 12px", fontWeight: "600" }}>Indicator Category</th>
                        <th style={{ padding: "10px 12px", fontWeight: "600", textAlign: "right" }}>Measured Value</th>
                        <th style={{ padding: "10px 12px", fontWeight: "600", textAlign: "right" }}>Unit</th>
                        <th style={{ padding: "10px 12px", fontWeight: "600", textAlign: "right" }}>Period Delta</th>
                        <th style={{ padding: "10px 12px", fontWeight: "600" }}>Validation Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "12px", fontWeight: "600", color: "#111827" }}>Electricity Intake</td>
                        <td style={{ padding: "12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {(preview.totals?.energy_mwh ?? 0).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right", color: "#6b7280" }}>MWh</td>
                        <td
                          style={{
                            padding: "12px",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: (preview.deltas?.energy_pct ?? 0) <= 0 ? "#166534" : "#991b1b",
                            fontWeight: "600",
                          }}
                        >
                          {(preview.deltas?.energy_pct ?? 0) > 0 ? "+" : ""}
                          {preview.deltas?.energy_pct ?? 0}%
                        </td>
                        <td style={{ padding: "12px", color: "#4b5563" }}>Live smart sub-meters</td>
                      </tr>

                      <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "12px", fontWeight: "600", color: "#111827" }}>Potable & Utility Water</td>
                        <td style={{ padding: "12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {(preview.totals?.water_ml ?? 0).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right", color: "#6b7280" }}>ML</td>
                        <td
                          style={{
                            padding: "12px",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: (preview.deltas?.water_pct ?? 0) <= 0 ? "#166534" : "#991b1b",
                            fontWeight: "600",
                          }}
                        >
                          {(preview.deltas?.water_pct ?? 0) > 0 ? "+" : ""}
                          {preview.deltas?.water_pct ?? 0}%
                        </td>
                        <td style={{ padding: "12px", color: "#4b5563" }}>Distribution flow sensors</td>
                      </tr>

                      <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "12px", fontWeight: "600", color: "#111827" }}>Natural Gas</td>
                        <td style={{ padding: "12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {(preview.totals?.gas_m3 ?? 0).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right", color: "#6b7280" }}>m³</td>
                        <td
                          style={{
                            padding: "12px",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: (preview.deltas?.gas_pct ?? 0) <= 0 ? "#166534" : "#991b1b",
                            fontWeight: "600",
                          }}
                        >
                          {(preview.deltas?.gas_pct ?? 0) > 0 ? "+" : ""}
                          {preview.deltas?.gas_pct ?? 0}%
                        </td>
                        <td style={{ padding: "12px", color: "#4b5563" }}>Kitchen & heating meters</td>
                      </tr>

                      <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "12px", fontWeight: "600", color: "#111827" }}>Organic Food Wastage</td>
                        <td style={{ padding: "12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          {(preview.totals?.food_kg ?? 0).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right", color: "#6b7280" }}>kg</td>
                        <td
                          style={{
                            padding: "12px",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: (preview.deltas?.food_pct ?? 0) <= 0 ? "#166534" : "#991b1b",
                            fontWeight: "600",
                          }}
                        >
                          {(preview.deltas?.food_pct ?? 0) > 0 ? "+" : ""}
                          {preview.deltas?.food_pct ?? 0}%
                        </td>
                        <td style={{ padding: "12px", color: "#4b5563" }}>Automated weighing scales</td>
                      </tr>

                      <tr style={{ background: "#f9fafb" }}>
                        <td style={{ padding: "12px", fontWeight: "700", color: "#111827" }}>Operational Emissions</td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                          {(preview.totals?.emissions_t ?? 0).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px", textAlign: "right", fontWeight: "600", color: "#374151" }}>tCO₂e</td>
                        <td
                          style={{
                            padding: "12px",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: (preview.deltas?.emissions_pct ?? 0) <= 0 ? "#166534" : "#991b1b",
                            fontWeight: "700",
                          }}
                        >
                          {(preview.deltas?.emissions_pct ?? 0) > 0 ? "+" : ""}
                          {preview.deltas?.emissions_pct ?? 0}%
                        </td>
                        <td style={{ padding: "12px", color: "#4b5563" }}>Grid factor (0.82 kg/kWh)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* DATA GAPS SECTION (Amber only for data gaps) */}
              {preview.data_gaps && preview.data_gaps.length > 0 && (
                <section
                  style={{
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: "6px",
                    padding: "16px 20px",
                    marginBottom: "28px",
                  }}
                  aria-label="Identified data gaps"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#92400e" }}>
                      Measurement gaps and observation notes
                    </h4>
                  </div>
                  <ul style={{ margin: "4px 0 0 0", paddingLeft: "24px", color: "#78350f", fontSize: "13px", lineHeight: 1.5 }}>
                    {preview.data_gaps.map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                </section>
              )}

              {/* METER COVERAGE FOOTER */}
              <footer
                style={{
                  borderTop: "1px solid #e5e7eb",
                  paddingTop: "14px",
                  fontSize: "12px",
                  color: "#6b7280",
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div>
                  Active hardware coverage:{" "}
                  <strong style={{ color: "#111827" }}>
                    {preview.meter_coverage?.reporting_in_period ?? 0} of {preview.meter_coverage?.active ?? 0}
                  </strong>{" "}
                  active meters reported telemetry.
                </div>
                <div>
                  Audit status: <span style={{ color: "#065f46", fontWeight: "600" }}>Verified by Officer</span>
                </div>
              </footer>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
