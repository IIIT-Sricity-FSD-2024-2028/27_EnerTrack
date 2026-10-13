/**
 * ReportsTable — the "Financial Reports" box: filters + table.
 * The filter dropdowns are controlled inputs; the visible rows are
 * worked out from the props on every render, so no extra state is needed.
 */
import { useState } from "react";
import Badge from "../components/Badge";
import { can, formatCurrency } from "../financeUtils";

export default function ReportsTable({ reports, role, onAdd, onView, onEdit, onArchive, onDelete }) {
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  const visible = reports.filter(
    (r) =>
      !r.archived &&
      (category === "all" || r.category === category) &&
      (status === "all" || r.status === status),
  );

  return (
    <div className="box">
      <div className="section-title">
        Financial Reports
        {can(role, "create") && (
          <button className="main-btn" onClick={onAdd}>+ Generate Report</button>
        )}
      </div>
      <div className="section-sub">View, edit, and delete generated financial impact reports.</div>

      <div className="filter-row">
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All Categories</option>
          <option value="energy">Energy</option>
          <option value="operations">Operations</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="viable">Viable</option>
          <option value="marginal">Marginal</option>
          <option value="not-viable">Not Viable</option>
        </select>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Period</th>
              <th>Category</th>
              <th>Scope</th>
              <th>ROI</th>
              <th>NPV</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>
                  No reports found.
                </td>
              </tr>
            ) : (
              visible.map((rep) => (
                <tr key={rep.id}>
                  <td>{rep.title}</td>
                  <td>{rep.period}</td>
                  <td style={{ textTransform: "capitalize" }}>{rep.category}</td>
                  <td>{rep.scopeLabel}</td>
                  <td>{rep.roi != null ? rep.roi + "%" : "—"}</td>
                  <td>{rep.npv != null ? formatCurrency(rep.npv) : "—"}</td>
                  <td><Badge status={rep.status} /></td>
                  <td className="action-cell">
                    <div className="action-row">
                      <button className="action-btn btn-view" onClick={() => onView(rep)}>View</button>
                      {can(role, "edit") && (
                        <button className="action-btn btn-edit" onClick={() => onEdit(rep)}>Edit</button>
                      )}
                      {can(role, "export") && (
                        <button className="action-btn btn-export" onClick={() => onArchive(rep)}>Archive</button>
                      )}
                    </div>
                    {can(role, "delete") && (
                      <button className="action-btn btn-delete" onClick={() => onDelete(rep)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
