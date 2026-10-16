/**
 * ArchiveTable — "Archived Work Orders": every closed work order.
 *
 * Shared by the Technician Administrator and Technician Jr work-order pages
 * (the Jr page passes only their own closed orders).
 *
 * Ported from renderArchive() in js/technician/workOrdersPage.js.
 */
import {
  capitalize,
  formatId,
  priorityBadgeClass,
  userName,
} from "../techUtils";

export default function ArchiveTable({ workOrders, users }) {
  return (
    <div className="card">
      <h2>Archived Work Orders</h2>
      <small>Closed and completed work orders from this shift.</small>
      <table className="archive-table mt-14">
        <thead>
          <tr>
            <th>WO ID</th>
            <th>Title</th>
            <th>Type</th>
            <th>Technician</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {workOrders.length === 0 && (
            <tr>
              <td colSpan="5">
                <div className="empty-state">No archived work orders yet.</div>
              </td>
            </tr>
          )}

          {workOrders.map((wo) => {
            const details = wo.details || {};

            // Coloured by priority, labelled by type — as before. An order
            // made through the API without details has no type, so say so
            // plainly rather than show an empty pill.
            let typeCell;
            if (details.type) {
              typeCell = (
                <span className={"badge " + priorityBadgeClass(wo.priority)}>
                  {capitalize(details.type)}
                </span>
              );
            } else {
              typeCell = <span className="sub">Not set</span>;
            }

            return (
              <tr key={wo.work_order_id}>
                <td>{formatId(wo.work_order_id, "WO")}</td>
                <td>{wo.title}</td>
                <td>{typeCell}</td>
                <td>{userName(users, wo.assigned_to_id)}</td>
                <td>
                  <span className="badge closed">Closed</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
