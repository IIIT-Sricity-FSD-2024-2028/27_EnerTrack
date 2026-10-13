/**
 * Archives — /campus/archives ("My Archives"). Read-only list of the
 * visitor's finished items. Replaces html/enduser/enduser_archives.html.
 *
 * Two sections:
 *   - Service Request Archives: issue reports that are closed (by their own
 *     status, or because a technician closed the work order made from them)
 *   - Wastage Report Archives: wastage reports the visitor archived,
 *     each drawn by <WastageArchiveCard>
 *
 * Works with the backend stopped: then reads the browser's local store.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import universalDB from "../../legacy/universalDB";
import WastageArchiveCard from "./WastageArchiveCard";
import campusCss from "./campus.css?inline";

// Loads this user's archived items. Returns { wastage: [...], requests: [...] }.
// Backend first; if that fails or finds nothing, the local store.
async function fetchArchives(user) {
  let wastage = [];
  let requests = [];

  try {
    const [wastageReports, serviceRequests, workOrders] = await Promise.all([
      api.get("/wastage-reports"),
      api.get("/service-requests"),
      api.get("/work-orders"),
    ]);
    const orders = Array.isArray(workOrders) ? workOrders : [];

    // My wastage reports that I archived, newest archive first
    if (Array.isArray(wastageReports)) {
      wastage = wastageReports
        .filter((r) => r.reporter_id === user.user_id && r.details?.archived)
        .map((r) => ({
          id: r.wastage_report_id,
          type: r.type,
          status: r.status,
          specificData: r.details?.specificData || {},
          costImpact: r.details?.costImpact || null,
          metricTarget: r.details?.metricTarget || null,
          priority: r.details?.priority || "Low",
          archivedAt: r.details?.archivedAt,
          dismissReason: r.details?.dismissReason,
        }))
        .sort(
          (a, b) => new Date(b.archivedAt || 0) - new Date(a.archivedAt || 0),
        );
    }

    // My service requests that are finished
    if (Array.isArray(serviceRequests)) {
      requests = serviceRequests
        .filter((sr) => {
          const closedByStatus = String(sr.status).toLowerCase() === "closed";
          const closedByWorkOrder = orders.some(
            (wo) =>
              wo.status === "closed" &&
              wo.source_request_id === sr.service_request_id,
          );
          return (
            sr.reporter_id === user.user_id &&
            (closedByStatus || closedByWorkOrder)
          );
        })
        .map((sr) => ({
          id: sr.service_request_id,
          description: sr.description || "Service request",
          priority: sr.priority || "medium",
        }))
        // The backend lists oldest first, so reverse it: newest on top
        .reverse();
    }
  } catch (err) {
    console.warn("[EndUser] Failed to fetch archives from backend:", err);
  }

  // Fallback: items saved in the browser while the backend was down
  if (wastage.length === 0 && requests.length === 0) {
    const local = universalDB.data.workflow;
    wastage = local.wastageReports
      .filter((r) => r.reporterEmail === user.email && r.archived)
      .sort(
        (a, b) =>
          new Date(b.archivedAt || b.timestamp) -
          new Date(a.archivedAt || a.timestamp),
      );
    requests = local.serviceRequests
      .filter(
        (sr) =>
          sr.reporterEmail === user.email &&
          String(sr.status).toLowerCase() === "closed",
      )
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  return { wastage, requests };
}

// Style shared by the two small section headings
const sectionTitleStyle = {
  margin: "0 0 10px 0",
  fontSize: "13px",
  color: "#374151",
};

export default function Archives() {
  const { user } = useAuth();
  const [wastage, setWastage] = useState([]);
  const [requests, setRequests] = useState([]);

  // Load the archives when the page opens
  useEffect(() => {
    fetchArchives(user).then((result) => {
      setWastage(result.wastage);
      setRequests(result.requests);
    });
  }, [user]);

  const total = wastage.length + requests.length;

  return (
    <div className="campus-page archives-page">
      <style>{campusCss}</style>

      <div className="header-row">
        <div className="page-header">
          <h1>My Archives</h1>
          <p>
            Previously completed reports and requests that have been archived.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "16px", color: "#111827" }}>
          Archived Reports
        </h3>
        <span className="ticket-count">{total}</span>
      </div>

      {total === 0 ? (
        <div className="empty-state">
          <p>No archived items yet.</p>
        </div>
      ) : (
        <div>
          {requests.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <h4 style={sectionTitleStyle}>Service Request Archives</h4>
              {requests.map((request) => (
                <ServiceRequestCard key={request.id} request={request} />
              ))}
            </div>
          )}

          {wastage.length > 0 && (
            <div>
              <h4 style={sectionTitleStyle}>Wastage Report Archives</h4>
              {wastage.map((report) => (
                <WastageArchiveCard key={report.id} report={report} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── One closed service request. Small, so it lives in this file. ── */

function ServiceRequestCard({ request }) {
  // "medium" -> "Medium", to match the .p-Medium CSS class
  const priority =
    request.priority.charAt(0).toUpperCase() + request.priority.slice(1);

  return (
    <div className="ticket-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          width: "100%",
          gap: "16px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "4px",
              marginBottom: "4px",
            }}
          >
            <strong style={{ fontSize: "14px", color: "var(--dark)" }}>
              #{request.id}
            </strong>
            <span
              style={{
                background: "#1f2937",
                color: "white",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                marginLeft: "8px",
              }}
            >
              Service Request
            </span>
          </div>

          <p
            style={{
              fontSize: "13px",
              color: "#374151",
              margin: "0 0 6px 0",
              lineHeight: 1.5,
            }}
          >
            {request.description}
          </p>

          <div
            style={{
              marginTop: "6px",
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              alignItems: "center",
            }}
          >
            <span className={`ticket-priority p-${priority}`}>
              {priority} Priority
            </span>
            {/* Only local items carry a date; the backend sends none */}
            {request.timestamp && (
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                Archived{" "}
                {new Date(request.timestamp).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            flexShrink: 0,
          }}
        >
          <span className="ticket-status status-finalized">Completed</span>
        </div>
      </div>
    </div>
  );
}
