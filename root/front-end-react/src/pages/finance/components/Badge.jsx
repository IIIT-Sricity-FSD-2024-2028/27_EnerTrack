/** Badge — the coloured status pill (badgeHTML() in the original). */
const BADGES = {
  viable: { cls: "badge-success", label: "Viable" },
  approved: { cls: "badge-success", label: "Approved" },
  paid: { cls: "badge-success", label: "Paid" },
  "under-budget": { cls: "badge-success", label: "Under Budget" },
  "on-budget": { cls: "badge-gray", label: "On Budget" },
  marginal: { cls: "badge-warning", label: "Marginal" },
  pending: { cls: "badge-warning", label: "Pending" },
  "over-budget": { cls: "badge-danger", label: "Over Budget" },
  overdue: { cls: "badge-danger", label: "Overdue" },
  "not-viable": { cls: "badge-danger", label: "Not Viable" },
};

export default function Badge({ status }) {
  const badge = BADGES[status] || { cls: "badge-gray", label: status };
  return <span className={`badge ${badge.cls}`}>{badge.label}</span>;
}
