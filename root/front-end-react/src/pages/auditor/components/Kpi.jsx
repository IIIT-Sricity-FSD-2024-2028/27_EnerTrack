/**
 * Kpi — one number tile at the top of the auditor overview.
 * Styles (.kpi, .kpi-value.pos, ...) are in platform_shared.css.
 *
 * `tone` is optional: "pos" turns the number green.
 */
export default function Kpi({ label, value, note, tone = "" }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className={"kpi-value " + tone} style={{ fontSize: "23px" }}>
        {value}
      </div>
      <div className="kpi-note">{note}</div>
    </div>
  );
}
