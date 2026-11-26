/**
 * Archives — /campus/archives ("My Archives"). Read-only list of the
 * visitor's finished items. Replaces html/enduser/enduser_archives.html.
 *
 * Two sections:
 *   - Service Request Archives: issue reports that are closed (by their own
 *     status, or because a technician closed the work order made from them)
 *   - Wastage Report Archives: wastage reports the visitor archived,
 *     each drawn by <WastageArchiveCard>
 */
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../../auth/useAuth";
import {
  fetchServiceRequests,
  selectAllServiceRequests,
} from "../../store/slices/serviceRequestsSlice";
import {
  fetchWastageReports,
  selectWastageRows,
} from "../../store/slices/wastageReportsSlice";
import WastageArchiveCard from "./WastageArchiveCard";
import { splitDescription } from "./serviceRequestHelpers";
import campusCss from "./campus.css?inline";

const CLOSED_STATUSES = ["closed", "resolved", "completed"];

// Style shared by the two small section headings
const sectionTitleStyle = {
  margin: "0 0 10px 0",
  fontSize: "13px",
  color: "#374151",
};

export default function Archives() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const wastageRows = useSelector(selectWastageRows);
  const serviceRequests = useSelector(selectAllServiceRequests);

  useEffect(() => {
    dispatch(fetchWastageReports());
    dispatch(fetchServiceRequests());
  }, [dispatch]);

  const wastage = useMemo(() => {
    if (!user) return [];
    return wastageRows
      .filter((r) => r.reporterId === user.user_id && r.details?.archived)
      .map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        specificData: r.specificData || {},
        costImpact: r.costImpact || null,
        metricTarget: r.metricTarget || null,
        priority: r.priority || "Low",
        archivedAt: r.details?.archivedAt,
        dismissReason: r.details?.dismissReason,
      }))
      .sort(
        (a, b) => new Date(b.archivedAt || 0) - new Date(a.archivedAt || 0),
      );
  }, [wastageRows, user]);

  const requests = useMemo(() => {
    if (!user) return [];
    return serviceRequests
      .filter((sr) => {
        const closed = CLOSED_STATUSES.includes(
          String(sr.status).toLowerCase(),
        );
        return sr.reporter_id === user.user_id && closed;
      })
      .map((sr) => {
        const parts = splitDescription(sr.description);
        return {
          id: sr.service_request_id,
          description: parts.description || "Service request",
          location: parts.location,
          issueType: sr.issue_type || parts.issueType,
          timestamp: sr.created_at, // when it was filed (none on seeded rows)
        };
      })
      // The backend lists oldest first, so reverse it: newest on top
      .reverse();
  }, [serviceRequests, user]);

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
                background: "#f3f4f6",
                color: "#374151",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                marginLeft: "8px",
              }}
            >
              {request.issueType || "Service Request"}
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

          {request.location && (
            <div className="ticket-location">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {request.location}
            </div>
          )}

          <div
            style={{
              marginTop: "6px",
              display: "flex",
              flexWrap: "wrap",
              gap: "6px",
              alignItems: "center",
            }}
          >
            {/* When the request was filed. Seeded requests have no date. */}
            {request.timestamp && (
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                Reported{" "}
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
