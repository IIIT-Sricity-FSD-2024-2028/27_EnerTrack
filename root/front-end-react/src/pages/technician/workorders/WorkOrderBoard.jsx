/**
 * WorkOrderBoard — the four-column board of open work orders.
 *
 * Shared by the Technician Administrator and Technician Jr work-order pages
 * (the Jr page passes only the orders assigned to them). Closed orders are
 * not on the board; they go to the archive table.
 *
 * Ported from renderBoard() / renderColumn() in js/technician/workOrdersPage.js.
 */
import WorkOrderCard from "./WorkOrderCard";

// The columns, left to right. `status` is the work-order status that
// belongs in that column.
const COLUMNS = [
  { status: "new", title: "New" },
  { status: "approval", title: "Cost Estimate Approval" },
  { status: "inprogress", title: "In Progress" },
  { status: "review", title: "Review / Ready to Close" },
];

export default function WorkOrderBoard({
  workOrders,
  users,
  selectedId,
  onSelect,
}) {
  return (
    <div className="board mt-16">
      {COLUMNS.map((column) => {
        const orders = workOrders.filter((wo) => wo.status === column.status);

        let chipClass = "count-chip";
        if (column.status === "inprogress") {
          chipClass = "count-chip green";
        }

        return (
          <div key={column.status} className="column">
            <div className="column-title">
              {column.title} <span className={chipClass}>{orders.length}</span>
            </div>

            {orders.length === 0 && (
              <div className="empty-state">No work orders</div>
            )}

            {orders.map((wo) => (
              <WorkOrderCard
                key={wo.work_order_id}
                wo={wo}
                users={users}
                selected={wo.work_order_id === selectedId}
                onSelect={onSelect}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
