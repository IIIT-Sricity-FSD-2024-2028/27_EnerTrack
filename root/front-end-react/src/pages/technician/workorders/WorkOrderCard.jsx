/**
 * WorkOrderCard — one card on the work-order board.
 *
 * Shared by the Technician Administrator and Technician Jr work-order
 * pages. It only draws: clicking it reports the id up through onSelect.
 *
 * A card is marked "rejected" (red edge) when it is back in New with nobody
 * assigned — that is what the Technician Jr's Reject button leaves behind.
 *
 * Ported from renderColumn() in js/technician/workOrdersPage.js.
 */
import { MoneyIcon, PersonIcon, PinIcon } from "../components/icons";
import { capitalize, estimateLabel, formatId, userName } from "../techUtils";

export default function WorkOrderCard({ wo, users, selected, onSelect }) {
  const details = wo.details || {};
  const asset = details.description || "General Maintenance";

  let cardClass = "task-card";
  if (selected) {
    cardClass += " selected-task";
  }
  if (wo.status === "new" && !wo.assigned_to_id) {
    cardClass += " task-card--rejected";
  }

  return (
    <div className={cardClass} onClick={() => onSelect(wo.work_order_id)}>
      <div className="task-title">
        {formatId(wo.work_order_id, "WO")}
        <span className={"priority-tag priority-" + wo.priority}>
          {capitalize(wo.priority)}
        </span>
      </div>
      <div>{wo.title}</div>
      <div className="task-meta">
        <span className="task-meta-row">
          <PersonIcon />
          <strong>Tech:</strong> {userName(users, wo.assigned_to_id)}
        </span>
        <span className="task-meta-row">
          <PinIcon />
          <strong>Asset:</strong> {asset}
        </span>
        <span className="task-meta-row">
          <MoneyIcon />
          <strong>Estimate:</strong> {estimateLabel(wo)}
        </span>
      </div>
    </div>
  );
}
