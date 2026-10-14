/**
 * WastageArchiveCard — one archived wastage report on /campus/archives.
 *
 * Display only: the parent (Archives.jsx) passes the report in through the
 * `report` prop. Each report looks like:
 *   { id, type, status, priority, archivedAt, dismissReason,
 *     specificData, costImpact, metricTarget }
 * costImpact and metricTarget may be null — their boxes are then left out.
 *
 * Replaces the wastageHtml part of the script in
 * html/enduser/enduser_archives.html.
 */

// Status -> pill label and colour class
const STATUS_MAP = {
  Finalized: { label: "Resolved", cssClass: "status-finalized" },
  "Target Set": { label: "Target Set", cssClass: "status-target-set" },
  Delivered: { label: "Report Delivered", cssClass: "status-finalized" },
  Dismissed: { label: "Dismissed", cssClass: "status-dismissed" },
};

// Every sentence of the Decision Summary uses this spacing
const paragraphStyle = { margin: "0 0 6px 0" };

// 12000 -> "₹12,000"
function formatCurrency(value) {
  return "₹" + Number(value).toLocaleString("en-IN");
}

// "2026-05-01T..." -> "1 May 2026"
function formatDate(value) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Each wastage type stores its text in different fields; pick the right ones.
function getSummaryAndLocation(report) {
  const data = report.specificData || {};

  if (report.type === "Energy") {
    return { summary: data.observation, location: data.building };
  }
  if (report.type === "Water") {
    return { summary: data.nature, location: data.location };
  }
  if (report.type === "Emissions") {
    return { summary: data.observation, location: data.location };
  }
  if (report.type === "Food") {
    return {
      summary: `${data.typeOfWastage || ""} (${data.estimatedAmount || "?"}kg)`,
      location: data.cafeteria,
    };
  }
  return { summary: "", location: "" };
}

export default function WastageArchiveCard({ report }) {
  const status = STATUS_MAP[report.status] || {
    label: report.status,
    cssClass: "status-finalized",
  };
  const { summary, location } = getSummaryAndLocation(report);
  const priority = report.priority || "Low";
  const type = report.type.toLowerCase();
  const impact = report.costImpact; // money figures from Finance, or null
  const target = report.metricTarget; // new target from the officer, or null

  return (
    <div className="ticket-card">
      {/* Row 1: details on the left, status pill on the right */}
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
              #{report.id}
            </strong>
            <span
              style={{
                background: "#059669",
                color: "white",
                padding: "2px 8px",
                borderRadius: "4px",
                fontSize: "11px",
                marginLeft: "8px",
              }}
            >
              {report.type} Wastage
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
            {summary}
          </p>

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
            {location}
          </div>

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
            <span style={{ fontSize: "11px", color: "#9ca3af" }}>
              Archived {report.archivedAt ? formatDate(report.archivedAt) : ""}
            </span>
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
          <span className={`ticket-status ${status.cssClass}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Row 2: impact and target boxes — only if there is data for them */}
      {(impact || target) && (
        <div className="ticket-expanded-section">
          {impact && (
            <div className="exp-box">
              <h5>Financial Impact Assessment</h5>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <div className="exp-sub">Est. Loss</div>
                  <div className="exp-val" style={{ color: "#dc2626" }}>
                    {formatCurrency(impact.estimatedLoss)}
                  </div>
                </div>
                <div>
                  <div className="exp-sub">Remediation</div>
                  <div className="exp-val">
                    {formatCurrency(impact.remediationCost)}
                  </div>
                </div>
                <div>
                  <div className="exp-sub">Savings</div>
                  <div className="exp-val" style={{ color: "#059669" }}>
                    {formatCurrency(impact.projectedSavings)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {target && (
            <div className="exp-box">
              <h5>Sustainability Target</h5>
              <div className="exp-val" style={{ color: "#1e40af" }}>
                {target.value}{" "}
                <small style={{ fontSize: "11px", fontWeight: 400 }}>
                  {target.unit}
                </small>
              </div>
              <div className="exp-sub">
                Deadline: {formatDate(target.deadline)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Row 3: Decision Summary — sentences appear only when they apply */}
      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "8px",
          padding: "14px",
          marginTop: "12px",
        }}
      >
        <h5
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.4px",
            color: "#065f46",
            margin: "0 0 8px 0",
          }}
        >
          Decision Summary
        </h5>
        <div style={{ fontSize: "12px", color: "#374151", lineHeight: 1.7 }}>
          <p style={paragraphStyle}>
            This {type} wastage report was reviewed and validated by the
            Sustainability Officer, confirming it as a substantiated concern
            requiring remediation.
          </p>

          {impact && (
            <p style={paragraphStyle}>
              Following financial due diligence, the Finance Analyst determined
              that the estimated economic impact of this issue amounts to{" "}
              <strong style={{ color: "#dc2626" }}>
                {formatCurrency(impact.estimatedLoss)}
              </strong>{" "}
              in projected losses if left unresolved. The recommended
              remediation cost stands at{" "}
              <strong>{formatCurrency(impact.remediationCost)}</strong>, with an
              anticipated annual saving of{" "}
              <strong style={{ color: "#059669" }}>
                {formatCurrency(impact.projectedSavings)}
              </strong>{" "}
              upon implementation.
            </p>
          )}

          {target && (
            <p style={paragraphStyle}>
              In response, the Sustainability Officer has established a revised{" "}
              {type} reduction target of{" "}
              <strong style={{ color: "#1e40af" }}>
                {target.value} {target.unit}
              </strong>
              , effective until <strong>{formatDate(target.deadline)}</strong>.
            </p>
          )}

          {report.status === "Dismissed" ? (
            <p style={paragraphStyle}>
              This report was dismissed by the Sustainability Officer. Reason:{" "}
              <strong>{report.dismissReason || "Not specified"}</strong>.
            </p>
          ) : (
            <p style={paragraphStyle}>
              This report has been formally closed and archived for your
              records.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
