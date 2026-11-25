/**
 * InitiativesSection — the "Initiatives" box on Finance's Reports & Impact
 * page: every approved initiative with its approved cost, what its jobs have
 * spent so far (approved expense bills), bills still waiting, the expected
 * saving a year and the payback. Read-only: Finance does not sign off
 * initiatives, the Organization Admin approves them. "Details" opens the
 * same full record the officer's Archives shows.
 */
import { Fragment, useEffect, useState } from "react";
import api from "../../../api/client";
import { useToast } from "../components/toastContext";
import {
  SpendLine,
  InitiativeSummary,
} from "../../sustainability/initiativeShared";
import { rupees } from "../../sustainability/initiativeUtils";

const STATUS = {
  approved: "In progress",
  "in-progress": "In progress",
  completed: "Completed",
};

export default function InitiativesSection() {
  const showToast = useToast();
  const [initiatives, setInitiatives] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [open, setOpen] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get("/initiatives"),
      api.get("/buildings").catch(() => []),
    ])
      .then(([list, b]) => {
        if (!active) return;
        const rows = (Array.isArray(list) ? list : []).filter(
          (i) => STATUS[String(i.status).toLowerCase()],
        );
        setInitiatives(rows);
        setBuildings(Array.isArray(b) ? b : []);
      })
      .catch((error) => {
        if (!active) return;
        setFailed(true);
        showToast(error.message || "Initiatives could not be loaded.", "error");
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  const sum = (key) =>
    initiatives.reduce((n, i) => n + Number(i.money?.[key] || 0), 0);
  const overBudget = initiatives.filter(
    (i) => i.money?.cost && i.money.spent > i.money.cost,
  ).length;

  return (
    <div className="box">
      <div className="section-title">Initiatives</div>
      <div className="section-sub">
        Approved sustainability initiatives: what each was approved to cost,
        what its technicians&apos; bills add up to so far, and what it should
        save.
      </div>

      <div className="summary-tiles">
        <div className="tile">
          <div className="tile-label">Approved cost</div>
          <div className="tile-value">{rupees(sum("cost"))}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Spent so far</div>
          <div className="tile-value">{rupees(sum("spent"))}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Over budget</div>
          <div
            className="tile-value"
            style={overBudget ? { color: "#dc2626" } : undefined}
          >
            {overBudget}
          </div>
        </div>
      </div>

      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>Initiative</th>
              <th>Status</th>
              <th>Spent of cost</th>
              <th>Expected saving a year</th>
              <th>Payback</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {initiatives.length === 0 ? (
              <tr>
                <td
                  colSpan="6"
                  style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}
                >
                  {failed
                    ? "Initiatives could not be loaded."
                    : "No approved initiatives yet."}
                </td>
              </tr>
            ) : (
              initiatives.map((i) => {
                const m = i.money || {};
                const isOpen = open === i.initiative_id;
                return (
                  <Fragment key={i.initiative_id}>
                    <tr>
                      <td>{i.title}</td>
                      <td>
                        <span
                          className={
                            "fin-status" + (String(i.status).toLowerCase() === "completed" ? " fin-status--done" : "")
                          }
                        >
                          {STATUS[String(i.status).toLowerCase()]}
                        </span>
                      </td>
                      <td style={{ minWidth: 180 }}>
                        {m.cost || m.spent || m.spend_pending ? (
                          <SpendLine money={m} compact />
                        ) : (
                          <span className="fin-muted">No cost given</span>
                        )}
                      </td>
                      <td>
                        {m.expected_saving_per_year
                          ? rupees(m.expected_saving_per_year)
                          : "—"}
                      </td>
                      <td>
                        {m.payback_years ? `${m.payback_years} years` : "—"}
                      </td>
                      <td className="action-cell">
                        <button
                          className="action-btn btn-view"
                          aria-expanded={isOpen}
                          onClick={() =>
                            setOpen(isOpen ? null : i.initiative_id)
                          }
                        >
                          {isOpen ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan="6">
                          <InitiativeSummary init={i} buildings={buildings} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
