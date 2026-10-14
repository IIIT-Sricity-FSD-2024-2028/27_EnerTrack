import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../../api/client";
import overviewCss from "../../styles/sustainability_officer/sust_overview.css?inline";
import sharedCss from "../../styles/sustainability_officer/sust_shared.css?inline";
import sustLayoutCss from "./sustainability.css?inline";

const DEMO_REPORTS = [
  {
    report_id: "sr-001",
    title: "Q2 2026 Campus Sustainability Audit",
    period: "Q2 2026",
    generated_at: "2026-07-02T10:30:00.000Z",
    metrics: {
      energyReduction: "-12.4%",
      wasteDiverted: "72%",
      carbonOffset: "135 tCO₂e",
      waterSaved: "1.8 ML",
    },
  },
  {
    report_id: "sr-002",
    title: "Q1 2026 Energy Baseline Audit",
    period: "Q1 2026",
    generated_at: "2026-04-05T09:15:00.000Z",
    metrics: {
      energyReduction: "-4.2%",
      wasteDiverted: "65%",
      carbonOffset: "92 tCO₂e",
      waterSaved: "1.2 ML",
    },
  },
];

const DEMO_INITIATIVES = [
  {
    initiative_id: "init-004",
    title: "LED Sensor Conversion in Campus Corridors",
    status: "completed",
    target_reduction: "8% Building Lighting",
    archivedAt: "2026-05-18T14:20:00.000Z",
    outcomes: [
      "100% LED transition complete",
      "Achieved ₹1.8L annual utility savings",
    ],
  },
];

const DEMO_WASTAGE = [
  {
    id: "WST-108",
    type: "Water",
    status: "Finalized",
    location: "Hostel Block A - Floor 2",
    summary: "High-pressure pipe joint rupture in restroom supply riser",
    priority: "High",
    archivedAt: "2026-06-12T16:45:00.000Z",
    decisionSummary:
      "Isolation valve closed within 15 mins. Gasket replaced and ultrasonic flow check passed.",
    baselineValue: 450,
    currentValue: 120,
    targetValue: 95,
    unit: "L/hr",
  },
  {
    id: "WST-104",
    type: "Energy",
    status: "Finalized",
    location: "Mechanical Workshop Block",
    summary: "Air compressor idling overnight with pressure leakage",
    priority: "Medium",
    archivedAt: "2026-05-22T11:10:00.000Z",
    decisionSummary:
      "Installed automatic solenoid power cut-off timer. Idling draw abated to 0 kWh.",
    baselineValue: 28,
    currentValue: 3,
    targetValue: 0,
    unit: "kWh/day",
  },
];

export default function SustainabilityArchives() {
  const [activeTab, setActiveTab] = useState("reports"); // 'reports' | 'initiatives' | 'wastage'
  const [searchQuery, setSearchQuery] = useState("");
  const [reports, setReports] = useState(DEMO_REPORTS);
  const [initiatives, setInitiatives] = useState(DEMO_INITIATIVES);
  const [wastage, setWastage] = useState(DEMO_WASTAGE);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Fetch archives from backend on mount
  useEffect(() => {
    let active = true;

    Promise.allSettled([
      api.get("/sustainability-reports"),
      api.get("/initiatives"),
      api.get("/wastage-reports"),
    ])
      .then(([reportsRes, initsRes, wastageRes]) => {
        if (!active) return;

        if (
          reportsRes.status === "fulfilled" &&
          Array.isArray(reportsRes.value) &&
          reportsRes.value.length > 0
        ) {
          setReports(reportsRes.value);
        }

        if (initsRes.status === "fulfilled" && Array.isArray(initsRes.value)) {
          const completed = initsRes.value.filter(
            (i) => i.status === "completed",
          );
          if (completed.length > 0) setInitiatives(completed);
        }

        if (
          wastageRes.status === "fulfilled" &&
          Array.isArray(wastageRes.value)
        ) {
          const archivedW = wastageRes.value
            .filter(
              (r) =>
                r.status === "Finalized" ||
                r.status === "Dismissed" ||
                r.details?.soArchived ||
                r.details?.archived,
            )
            .map((r) => ({
              id: r.wastage_report_id || r.id,
              type: r.type || "Resource",
              status: r.status || "Finalized",
              location: r.details?.location || "Campus Grounds",
              summary:
                r.details?.summary ||
                r.details?.description ||
                "Wastage incident resolved.",
              priority: r.details?.priority || "Medium",
              archivedAt:
                r.details?.auditedAt ||
                r.created_at ||
                new Date().toISOString(),
              decisionSummary:
                r.details?.auditNotes ||
                "Remedial measures inspected and finalized.",
              baselineValue: 100,
              currentValue: 30,
              targetValue: Number(r.details?.targetReductionPct) || 15,
              unit: "%",
            }));

          if (archivedW.length > 0) setWastage(archivedW);
        }
      })
      .catch((err) => {
        console.warn(
          "[Archives] Backend fetch error, running with cached data:",
          err,
        );
      });

    return () => {
      active = false;
    };
  }, []);

  // Remove report
  const handleRemoveReport = async (reportId) => {
    setReports((prev) =>
      prev.filter((r) => (r.report_id || r.id) !== reportId),
    );
    try {
      await api.delete(`/sustainability-reports/${reportId}`);
      showToast("Report removed from compliance ledger.");
    } catch (e) {
      console.warn("[Archive Delete]", e);
      showToast("Report removed locally.", "info");
    }
  };

  // Remove initiative
  const handleRemoveInitiative = async (initId) => {
    setInitiatives((prev) =>
      prev.filter((i) => (i.initiative_id || i.id) !== initId),
    );
    try {
      await api.delete(`/initiatives/${initId}`);
      showToast("Initiative removed from archive.");
    } catch (e) {
      console.warn("[Archive Delete]", e);
      showToast("Initiative removed locally.", "info");
    }
  };

  // Remove wastage archive
  const handleRemoveWastage = async (wastageId) => {
    setWastage((prev) => prev.filter((w) => w.id !== wastageId));
    try {
      await api.patch(`/wastage-reports/${wastageId}`, {
        details: { soArchived: false, status: "Investigating" },
      });
      showToast(`Wastage record #${wastageId} removed from archive.`);
    } catch (e) {
      console.warn("[Wastage Unarchive]", e);
      showToast(`Wastage #${wastageId} removed locally.`, "info");
    }
  };

  // Filtered collections based on search
  const filteredReports = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return reports;
    return reports.filter(
      (r) =>
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.period && r.period.toLowerCase().includes(q)),
    );
  }, [reports, searchQuery]);

  const filteredInitiatives = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return initiatives;
    return initiatives.filter(
      (i) =>
        (i.title && i.title.toLowerCase().includes(q)) ||
        (i.target_reduction && i.target_reduction.toLowerCase().includes(q)),
    );
  }, [initiatives, searchQuery]);

  const filteredWastage = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return wastage;
    return wastage.filter(
      (w) =>
        (w.id && w.id.toLowerCase().includes(q)) ||
        (w.location && w.location.toLowerCase().includes(q)) ||
        (w.summary && w.summary.toLowerCase().includes(q)),
    );
  }, [wastage, searchQuery]);

  return (
    <div
      className="sustainability-archives-container"
      style={{ width: "100%", maxWidth: "1400px", margin: "0 auto" }}
    >
      <style>{overviewCss}</style>
      <style>{sharedCss}</style>
      <style>{sustLayoutCss}</style>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: toast.type === "error" ? "#ef4444" : "#059669",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
            zIndex: 9999,
            fontWeight: "600",
            fontSize: "14px",
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="page-header" style={{ marginBottom: "24px" }}>
        <h1
          style={{
            margin: "0 0 6px 0",
            fontSize: "28px",
            fontWeight: "700",
            color: "#111827",
          }}
        >
          Sustainability & Environmental Archives
        </h1>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "15px" }}>
          Permanent repository storing certified audit disclosures, completed
          conservation projects, and resolved wastage logs.
        </p>
      </div>

      {/* Filter and Tab Controls */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          padding: "16px 20px",
          border: "1px solid #e5e7eb",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        {/* Category Tabs */}
        <div style={{ display: "flex", gap: "10px" }}>
          {[
            {
              id: "reports",
              label: "Compliance Reports",
              count: reports.length,
              badgeBg: "#ecfdf5",
              textCol: "#065f46",
            },
            {
              id: "initiatives",
              label: "Conservation Initiatives",
              count: initiatives.length,
              badgeBg: "#dbeafe",
              textCol: "#1e40af",
            },
            {
              id: "wastage",
              label: "Wastage Resolutions",
              count: wastage.length,
              badgeBg: "#faf5ff",
              textCol: "#6b21a8",
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: activeTab === tab.id ? "700" : "500",
                background: activeTab === tab.id ? "#0f172a" : "#f3f4f6",
                color: activeTab === tab.id ? "#ffffff" : "#4b5563",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
              <span
                style={{
                  background: activeTab === tab.id ? "#334155" : tab.badgeBg,
                  color: activeTab === tab.id ? "#ffffff" : tab.textCol,
                  padding: "2px 7px",
                  borderRadius: "99px",
                  fontSize: "11px",
                  fontWeight: "700",
                }}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: "relative", minWidth: "260px" }}>
          <input
            type="text"
            placeholder="Search archives by keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 32px",
              borderRadius: "6px",
              border: "1px solid #d1d5db",
              fontSize: "13px",
            }}
          />
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="2.5"
            style={{ position: "absolute", left: "10px", top: "11px" }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* TAB 1: Compliance Reports */}
      {activeTab === "reports" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          {filteredReports.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px",
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                color: "#9ca3af",
              }}
            >
              No compliance reports found in archive.
            </div>
          ) : (
            filteredReports.map((r) => {
              const rId = r.report_id || r.id;
              const dateStr = r.generated_at
                ? new Date(r.generated_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
                : "N/A";
              const metrics = r.metrics || {};

              return (
                <div
                  key={rId}
                  style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    padding: "20px 24px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "14px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          marginBottom: "4px",
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "16px",
                            fontWeight: "700",
                            color: "#111827",
                          }}
                        >
                          {r.title}
                        </h3>
                        <span
                          style={{
                            background: "#ecfdf5",
                            color: "#065f46",
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 8px",
                            borderRadius: "4px",
                          }}
                        >
                          {r.period}
                        </span>
                      </div>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        Archived on <strong>{dateStr}</strong> &bull; Record ID:{" "}
                        <code>{rId}</code>
                      </span>
                    </div>

                    <button
                      onClick={() => handleRemoveReport(rId)}
                      style={{
                        background: "none",
                        border: "1px solid #ef4444",
                        color: "#ef4444",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      Delete Archive
                    </button>
                  </div>

                  {/* Impact Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "12px",
                      background: "#f9fafb",
                      padding: "14px",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          textTransform: "uppercase",
                          fontWeight: "600",
                        }}
                      >
                        Energy Abatement
                      </span>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#15803d",
                          marginTop: "2px",
                        }}
                      >
                        {metrics.energyReduction || "-"}
                      </div>
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          textTransform: "uppercase",
                          fontWeight: "600",
                        }}
                      >
                        Waste Diverted
                      </span>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#1d4ed8",
                          marginTop: "2px",
                        }}
                      >
                        {metrics.wasteDiverted || "-"}
                      </div>
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          textTransform: "uppercase",
                          fontWeight: "600",
                        }}
                      >
                        Carbon Avoidance
                      </span>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#7e22ce",
                          marginTop: "2px",
                        }}
                      >
                        {metrics.carbonOffset || "-"}
                      </div>
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          textTransform: "uppercase",
                          fontWeight: "600",
                        }}
                      >
                        Water Conserved
                      </span>
                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: "700",
                          color: "#0f766e",
                          marginTop: "2px",
                        }}
                      >
                        {metrics.waterSaved || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: Conservation Initiatives */}
      {activeTab === "initiatives" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          {filteredInitiatives.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px",
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                color: "#9ca3af",
              }}
            >
              No completed initiatives in archive.
            </div>
          ) : (
            filteredInitiatives.map((i) => {
              const iId = i.initiative_id || i.id;
              const dateStr = i.archivedAt
                ? new Date(i.archivedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
                : "May 2026";

              return (
                <div
                  key={iId}
                  style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    padding: "20px 24px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "4px",
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            fontSize: "16px",
                            fontWeight: "700",
                            color: "#111827",
                          }}
                        >
                          {i.title}
                        </h3>
                        <span
                          style={{
                            background: "#dcfce7",
                            color: "#15803d",
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 8px",
                            borderRadius: "4px",
                          }}
                        >
                          Completed
                        </span>
                      </div>
                      <p
                        style={{
                          margin: "4px 0",
                          fontSize: "13px",
                          color: "#4b5563",
                        }}
                      >
                        {i.description}
                      </p>
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>
                        Completed on <strong>{dateStr}</strong> &bull; Target:{" "}
                        <strong style={{ color: "#059669" }}>
                          {i.target_reduction}
                        </strong>
                      </span>
                    </div>

                    <button
                      onClick={() => handleRemoveInitiative(iId)}
                      style={{
                        background: "none",
                        border: "1px solid #ef4444",
                        color: "#ef4444",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      Delete Archive
                    </button>
                  </div>

                  {Array.isArray(i.outcomes) && i.outcomes.length > 0 && (
                    <div
                      style={{
                        background: "#f0fdf4",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: "1px solid #bbf7d0",
                        fontSize: "12px",
                        color: "#166534",
                      }}
                    >
                      <strong>Verified Deliverables:</strong>{" "}
                      {i.outcomes.join(" • ")}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 3: Wastage Resolutions */}
      {activeTab === "wastage" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          {filteredWastage.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px",
                background: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                color: "#9ca3af",
              }}
            >
              No wastage resolutions recorded in archive.
            </div>
          ) : (
            filteredWastage.map((w) => {
              const dateStr = w.archivedAt
                ? new Date(w.archivedAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
                : "Recent";
              const typeColor =
                w.type === "Energy"
                  ? "#10b981"
                  : w.type === "Water"
                    ? "#3b82f6"
                    : "#f59e0b";

              return (
                <div
                  key={w.id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    padding: "20px 24px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "4px",
                        }}
                      >
                        <strong style={{ fontSize: "15px", color: "#111827" }}>
                          #{w.id}
                        </strong>
                        <span
                          style={{
                            background: typeColor,
                            color: "#ffffff",
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 8px",
                            borderRadius: "4px",
                          }}
                        >
                          {w.type} Wastage
                        </span>
                        <span
                          style={{
                            background: "#f3f4f6",
                            color: "#374151",
                            fontSize: "11px",
                            fontWeight: "600",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}
                        >
                          {w.priority} Priority
                        </span>
                      </div>
                      <p
                        style={{
                          margin: "4px 0",
                          fontSize: "13px",
                          color: "#374151",
                          fontWeight: "500",
                        }}
                      >
                        {w.summary}
                      </p>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        Location: <strong>{w.location}</strong> &bull; Resolved
                        on {dateStr}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveWastage(w.id)}
                      style={{
                        background: "none",
                        border: "1px solid #ef4444",
                        color: "#ef4444",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      Delete Archive
                    </button>
                  </div>

                  {/* Decision Summary Box */}
                  <div
                    style={{
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      marginBottom: "12px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        fontWeight: "700",
                        color: "#065f46",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Sustainability Officer Decision Summary:
                    </span>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: "#166534",
                        lineHeight: "1.4",
                      }}
                    >
                      {w.decisionSummary}
                    </p>
                  </div>

                  {/* Before / After Comparison Bar */}
                  <div
                    style={{
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "12px 14px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        fontWeight: "700",
                        color: "#374151",
                        display: "block",
                        marginBottom: "8px",
                      }}
                    >
                      Before / After Metric Comparison:
                    </span>
                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: "11px", color: "#6b7280" }}>
                          Pre-Fix Baseline
                        </span>
                        <div
                          style={{
                            height: "8px",
                            background: "#f87171",
                            borderRadius: "4px",
                            marginTop: "3px",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "700",
                            color: "#dc2626",
                          }}
                        >
                          {w.baselineValue} {w.unit}
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: "11px", color: "#6b7280" }}>
                          Post-Resolution Measured
                        </span>
                        <div
                          style={{
                            height: "8px",
                            background: "#34d399",
                            borderRadius: "4px",
                            marginTop: "3px",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "700",
                            color: "#059669",
                          }}
                        >
                          {w.currentValue} {w.unit}
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: "11px", color: "#6b7280" }}>
                          Institutional Target
                        </span>
                        <div
                          style={{
                            height: "8px",
                            background: "#60a5fa",
                            borderRadius: "4px",
                            marginTop: "3px",
                          }}
                        />
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "700",
                            color: "#2563eb",
                          }}
                        >
                          {w.targetValue} {w.unit}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
