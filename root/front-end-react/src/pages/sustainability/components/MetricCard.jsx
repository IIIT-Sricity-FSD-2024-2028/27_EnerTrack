export default function MetricCard({
  id,
  title,
  value,
  unit,
  delta,
  description,
  footer,
  icon,
  badge,
}) {
  return (
    <div
      className="metric-card"
      style={{
        background: "#ffffff",
        border: "1px solid #d8dde2",
        borderRadius: "8px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: "160px",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
            }}
          >
            {title}
          </h3>
          {icon && (
            <span style={{ color: "#059669", opacity: 0.9, display: "inline-flex" }}>
              {icon}
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "8px",
            margin: "8px 0 6px 0",
          }}
        >
          <span
            id={id}
            style={{
              fontSize: "28px",
              fontWeight: "700",
              color: "#111827",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value}
          </span>
          {unit && (
            <small
              style={{
                fontSize: "14px",
                color: "#6b7280",
                fontWeight: "500",
              }}
            >
              {unit}
            </small>
          )}
          {delta !== undefined && delta !== null && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: "12px",
                fontWeight: "600",
                color:
                  typeof delta === "number"
                    ? delta < 0
                      ? "#059669"
                      : delta > 0
                      ? "#b91c1c"
                      : "#6b7280"
                    : "#6b7280",
                background:
                  typeof delta === "number"
                    ? delta < 0
                      ? "#ecfdf5"
                      : delta > 0
                      ? "#fef2f2"
                      : "#f3f4f6"
                    : "#f3f4f6",
                padding: "2px 6px",
                borderRadius: "4px",
              }}
            >
              {typeof delta === "number" ? `${delta > 0 ? "+" : ""}${delta}%` : delta}
            </span>
          )}
        </div>

        {description && (
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "12px",
              color: "#6b7280",
              lineHeight: 1.4,
            }}
          >
            {description}
          </p>
        )}
      </div>

      {footer && (
        <div
          style={{
            marginTop: "14px",
            paddingTop: "10px",
            borderTop: "1px solid #f3f4f6",
            fontSize: "12px",
            color: "#4b5563",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>{footer}</span>
          {badge && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: "600",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "#f3f4f6",
                color: "#374151",
              }}
            >
              {badge}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
