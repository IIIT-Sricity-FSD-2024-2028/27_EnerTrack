/**
 * StatCard — one number card on an overview page.
 *
 * It owns no state and fetches nothing: the page works out the numbers and
 * passes them in. Used by the Technician and Technician Jr overviews.
 *
 * `tone` picks the colour of the icon box from tech_overview.css:
 * "yellow", "red" or "green".
 */
export default function StatCard({ icon, tone, label, value, note }) {
  return (
    <div className="stat-card">
      <div className={"stat-icon " + tone}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}
