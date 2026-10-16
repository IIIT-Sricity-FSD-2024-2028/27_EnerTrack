import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import overviewCss from "../../styles/sustainability_officer/sust_overview.css?inline";
import sharedCss from "../../styles/sustainability_officer/sust_shared.css?inline";
import sustLayoutCss from "./sustainability.css?inline";
import WastageArchive from "./archives/WastageArchive";
import { normalizeStatus } from "./audit/auditShared";
import { normalizeWastageReport } from "../finance/financeApi";
import { reportRef, wastageSummary } from "../finance/financeUtils";

export default function SustainabilityArchives() {
  const { user } = useAuth();
  const canDeleteReport =
    user?.role === "Organization Admin" ||
    user?.role === "Sustainability Officer";
  const canDeleteInitiative =
    user?.role === "Organization Admin" ||
    user?.role === "Sustainability Officer";
  // The backend lets only the Organization Admin delete a wastage report.
  const canDeleteWastage = user?.role === "Organization Admin";

  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get("tab");
  // The tab lives in the URL (?tab=), so links and the back button land on it.
  const activeTab = ["reports", "initiatives", "wastage"].includes(urlTab)
    ? urlTab
    : "reports";

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [reports, setReports] = useState([]);
  const [initiatives, setInitiatives] = useState([]);
  const [wastage, setWastage] = useState([]);
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
      api.get("/users"),
    ])
      .then(([reportsRes, initsRes, wastageRes, usersRes]) => {
        if (!active) return;

        if (
          reportsRes.status === "fulfilled" &&
          Array.isArray(reportsRes.value)
        ) {
          setReports(reportsRes.value);
        }

        // Load initiatives: merge from backend completed AND locally archived initiatives
        const localArchives = (() => {
          try {
            const raw = localStorage.getItem("enertrack_universal_v1");
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed?.sust?.initiativeArchives)
              ? parsed.sust.initiativeArchives
              : [];
          } catch {
            return [];
          }
        })();

        const backendCompleted =
          initsRes.status === "fulfilled" && Array.isArray(initsRes.value)
            ? initsRes.value.filter((i) => i.status === "completed")
            : [];

        const combinedMap = new Map();
        localArchives.forEach((item) => {
          const key = item.initiative_id || item.id;
          if (key) combinedMap.set(key, { ...item, initiative_id: key });
        });
        backendCompleted.forEach((item) => {
          const key = item.initiative_id || item.id;
          if (key && !combinedMap.has(key)) combinedMap.set(key, item);
        });

        setInitiatives(Array.from(combinedMap.values()));

        if (
          wastageRes.status === "fulfilled" &&
          Array.isArray(wastageRes.value)
        ) {
          // Who reported each one, by name; optional.
          const directory = {};
          if (usersRes.status === "fulfilled" && Array.isArray(usersRes.value))
            usersRes.value.forEach((u) => (directory[u.user_id] = u));

          // Closed reports only: sent to the occupant, dismissed, or
          // archived by the officer. The rest are still in the overview queue.
          const archivedW = wastageRes.value
            .map((raw) => {
              const r = normalizeWastageReport(raw, user);
              const reporter = directory[raw.reporter_id];
              return {
                ...r,
                status: normalizeStatus(r.status),
                shortId: reportRef(r.id),
                priority: r.details?.priority || "Medium",
                reporterName:
                  reporter?.name ||
                  (r.reporterName && r.reporterName !== "Unknown" ? r.reporterName : "Occupant"),
              };
            })
            .filter(
              (r) =>
                r.status === "Delivered" ||
                r.status === "Dismissed" ||
                r.details?.soArchived,
            )
            .sort((x, y) => {
              const at = (r) =>
                r.details?.deliveredAt || r.details?.dismissedAt || r.details?.soArchivedAt || r.timestamp;
              return String(at(y)).localeCompare(String(at(x)));
            });

          setWastage(archivedW);
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
  }, [user]);

  // Remove report
  const handleRemoveReport = async (reportId) => {
    setReports((prev) =>
      prev.filter((r) => (r.report_id || r.id) !== reportId),
    );
    try {
      const raw = localStorage.getItem("enertrack_universal_v1");
      if (raw) {
        const data = JSON.parse(raw);
        if (data.sust?.complianceReports) {
          data.sust.complianceReports = data.sust.complianceReports.filter(
            (r) => (r.report_id || r.id) !== reportId,
          );
          localStorage.setItem("enertrack_universal_v1", JSON.stringify(data));
        }
      }
    } catch (err) {
      console.warn("[Archives] Failed to clean report localStorage:", err);
    }

    try {
      await api.delete(`/sustainability-reports/${reportId}`);
    } catch (e) {
      console.warn("[Archive Report Delete] Backend sync info:", e?.message);
    }
    showToast("Report removed from compliance ledger.", "success");
  };

  // Remove initiative
  const handleRemoveInitiative = async (initId) => {
    // 1. Optimistically remove from UI state
    setInitiatives((prev) =>
      prev.filter((i) => (i.initiative_id || i.id) !== initId),
    );

    // 2. Remove from universal local storage
    try {
      const raw = localStorage.getItem("enertrack_universal_v1");
      if (raw) {
        const data = JSON.parse(raw);
        if (data.sust?.initiativeArchives) {
          data.sust.initiativeArchives = data.sust.initiativeArchives.filter(
            (i) => (i.initiative_id || i.id) !== initId,
          );
          localStorage.setItem("enertrack_universal_v1", JSON.stringify(data));
        }
      }
    } catch (err) {
      console.warn("[Archives] Failed to clean initiative localStorage:", err);
    }

    // 3. Sync deletion to backend (if present in database; 404 is expected for already archived records)
    try {
      await api.delete(`/initiatives/${initId}`);
    } catch (e) {
      console.warn("[Archive Delete] Backend sync notice:", e?.message);
    }

    showToast("Initiative removed from archive.", "success");
  };

  // Delete a closed wastage report for good (Organization Admin only).
  const handleDeleteWastage = async (report) => {
    try {
      await api.delete(`/wastage-reports/${report.id}`);
      setWastage((prev) => prev.filter((w) => w.id !== report.id));
      showToast(`WR-${report.shortId} deleted.`, "success");
    } catch (err) {
      showToast(err.message || "Could not delete the report.", "error");
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
    return wastage.filter((w) => {
      const { summary, location } = wastageSummary(w);
      return [`WR-${w.shortId}`, w.type, location, summary, w.reporterName]
        .filter(Boolean)
        .some((text) => String(text).toLowerCase().includes(q));
    });
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
              onClick={() => handleTabChange(tab.id)}
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

                    {canDeleteReport && (
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
                    )}
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
                          {i.target_reduction || i.target || "—"}
                        </strong>
                      </span>
                      {i.outcomes && i.outcomes.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                          {i.outcomes.map((o, idx) => (
                            <span
                              key={idx}
                              style={{
                                background: "#f0fdf4",
                                color: "#166534",
                                border: "1px solid #bbf7d0",
                                fontSize: "11px",
                                fontWeight: "600",
                                padding: "2px 8px",
                                borderRadius: "4px",
                              }}
                            >
                              ✓ {typeof o === "string" ? o : JSON.stringify(o)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {canDeleteInitiative && (
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
                    )}
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
        <WastageArchive
          reports={filteredWastage}
          totalCount={wastage.length}
          canDelete={canDeleteWastage}
          onDelete={handleDeleteWastage}
        />
      )}
    </div>
  );
}
