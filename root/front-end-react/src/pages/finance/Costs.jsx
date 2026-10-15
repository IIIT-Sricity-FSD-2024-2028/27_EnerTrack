/**
 * Costs — /finance/costs (was finance_costs.html).
 *
 * Summary tiles, the energy cost records table (add / view / edit /
 * delete with scope and period filters), the "Retrieve & Calculate"
 * simulation and the cost breakdown charts.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import Badge from "./components/Badge";
import FinanceLayout from "./components/FinanceLayout";
import ToastProvider from "./components/ToastProvider";
import Modal from "./components/Modal";
import { useToast } from "./components/toastContext";
import { useAuth } from "../../auth/useAuth";
import CostBreakdown from "./costs/CostBreakdown";
import CostFormModal from "./costs/CostFormModal";
import CostViewModal from "./costs/CostViewModal";
import {
  loadDepartmentsAndBuildings,
  loadEnergyCosts,
  normalizeCost,
  saveLocalFinance,
} from "./financeApi";
import { can, formatCurrency, generateId, statusFromVariance } from "./financeUtils";
import costsCss from "../../styles/finance-analyst/finance_costs.css?inline";
import sharedCss from "../../styles/finance-analyst/finance_shared.css?inline";

/** Adds up the five amounts and works out variance + status. */
function withTotals(amounts) {
  const total =
    amounts.electricity + amounts.gas + amounts.water + amounts.wastewater + amounts.demand;
  const variance = amounts.budget - total;
  return { ...amounts, total, variance, status: statusFromVariance(variance) };
}

/** Reads the five amounts and the budget from the form as numbers. */
function amountsFromForm(form) {
  return {
    electricity: Number(form.electricity),
    gas: Number(form.gas),
    water: Number(form.water),
    wastewater: Number(form.wastewater),
    demand: Number(form.demand),
    budget: Number(form.budget),
  };
}

function CostsContent() {
  const { user } = useAuth();
  const showToast = useToast();
  const [costs, setCosts] = useState([]);
  const [offline, setOffline] = useState(false);
  const [places, setPlaces] = useState({ departments: [], buildings: [] });
  const [scopeFilter, setScopeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("");
  const [modal, setModal] = useState(null); // { kind: "view" | "add" | "edit" | "delete", record }
  const [pending, setPending] = useState(true); // analytics wait for "Retrieve & Calculate"
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    loadEnergyCosts()
      .then((result) => {
        setCosts(result.costs);
        setOffline(result.offline);
      })
      .catch((error) => showToast(error.message, "error"));
    loadDepartmentsAndBuildings().then(setPlaces);
  }, [showToast]);

  function updateList(next) {
    setCosts(next);
    if (offline) saveLocalFinance("energyCosts", next);
  }

  async function handleAdd(form) {
    const values = withTotals(amountsFromForm(form));
    const payload = {
      ...values,
      period: form.period,
      scope: form.scopeType,
      scope_label: form.scopeLabel,
      department_id: form.scopeType === "department" ? form.scopeRef : undefined,
      building_id: form.scopeType === "building" ? form.scopeRef : undefined,
    };

    let created = normalizeCost({ ...payload, id: generateId("ec") });
    if (!offline) {
      try {
        const res = await api.post("/energy-costs", payload);
        created = normalizeCost({ ...payload, ...res });
      } catch (error) {
        showToast("Error saving cost record: " + error.message, "error");
        return;
      }
    }
    updateList([...costs, created]);
    setModal(null);
    showToast("Energy cost record added.", "success");
  }

  async function handleEdit(form) {
    const record = modal.record;
    const payload = withTotals(amountsFromForm(form));
    if (!offline) {
      try {
        await api.patch(`/energy-costs/${record.id}`, payload);
      } catch (error) {
        showToast("Error updating cost record: " + error.message, "error");
        return;
      }
    }
    updateList(costs.map((c) => (c.id === record.id ? { ...c, ...payload } : c)));
    setModal(null);
    showToast("Cost record updated.", "success");
  }

  async function handleDelete(record) {
    setModal(null);
    if (!offline) {
      try {
        await api.delete(`/energy-costs/${record.id}`);
      } catch (error) {
        showToast("Failed to delete cost record: " + error.message, "error");
        return;
      }
    }
    updateList(costs.filter((c) => c.id !== record.id));
    showToast("Cost record deleted.", "success");
  }

  /**
   * "Retrieve & Calculate" — a simulated meter sweep. After two progress
   * toasts every amount moves by up to ±2% and the analytics unlock.
   * (Like the original, the simulated figures are not saved.)
   */
  function handleRetrieve() {
    setCalculating(true);
    showToast("Triggering campus consumption sweep...", "info", 1500);
    setTimeout(() => {
      showToast("Synchronizing with Building Management Systems...", "info", 1500);
      setTimeout(() => {
        setCosts((current) =>
          current.map((rec) => {
            const factor = 1 + (Math.random() * 0.04 - 0.02); // 0.98 – 1.02
            const vary = (value) => Math.round((Number(value) || 0) * factor);
            return {
              ...rec,
              ...withTotals({
                electricity: vary(rec.electricity),
                gas: vary(rec.gas),
                water: vary(rec.water),
                wastewater: vary(rec.wastewater),
                demand: vary(rec.demand),
                budget: rec.budget,
              }),
            };
          }),
        );
        setPending(false);
        setCalculating(false);
        showToast("Financial calculation complete. Charts updated.", "success");
      }, 1800);
    }, 1500);
  }

  /** Downloads the cost records as a .csv file. */
  function handleExportCsv() {
    const header = ["Period", "Scope", "Reference", "Electricity", "Gas", "Water", "Wastewater", "Demand", "Total", "Budget", "Variance", "Status"];
    const rows = costs.map((c) =>
      [c.period, c.scope, c.scopeLabel, c.electricity, c.gas, c.water, c.wastewater, c.demand, c.total, c.budget, c.variance, c.status]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "utility-costs.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ── derived values ──
  const periods = [...new Set(costs.map((c) => c.period))].sort().reverse();
  const visible = costs.filter(
    (c) =>
      (scopeFilter === "all" || c.scope === scopeFilter) &&
      (periodFilter === "" || c.period === periodFilter),
  );
  const totalCost = costs.reduce((s, c) => s + c.total, 0);
  const totalBudget = costs.reduce((s, c) => s + c.budget, 0);
  const overBudget = costs.filter((c) => c.status === "over-budget").length;
  const role = user.role;

  return (
    <FinanceLayout styles={[costsCss, sharedCss]}>
      <div className="page-title">Utility Costs</div>
      <div className="page-sub">
        Retrieve, add, edit and delete utility consumption records. Compare against budget with
        automatic variance calculation.
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="tile-label">Total Cost (all records)</div>
          <div className="tile-value">{formatCurrency(totalCost)}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Total Budget</div>
          <div className="tile-value">{formatCurrency(totalBudget)}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Over-Budget Records</div>
          <div className="tile-value" style={{ color: "#dc2626" }}>{overBudget}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          Energy Cost Records
          {can(role, "create") && (
            <button className="main-btn" onClick={() => setModal({ kind: "add" })}>+ Add Record</button>
          )}
        </div>
        <div className="card-sub">
          All utility cost records across departments and buildings. Filter by scope or period.
        </div>

        <div className="filter-row">
          <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
            <option value="all">All Scopes</option>
            <option value="department">Department</option>
            <option value="building">Building</option>
          </select>
          <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
            <option value="">All Periods</option>
            {periods.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Scope</th>
                <th>Reference</th>
                <th>Electricity</th>
                <th>Gas</th>
                <th>Water</th>
                <th>Wastewater</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center", color: "#9ca3af", padding: 32 }}>
                    No records found.
                  </td>
                </tr>
              ) : (
                visible.map((rec) => (
                  <tr key={rec.id}>
                    <td>{rec.period}</td>
                    <td style={{ textTransform: "capitalize" }}>{rec.scope}</td>
                    <td>{rec.scopeLabel}</td>
                    <td>{formatCurrency(rec.electricity)}</td>
                    <td>{formatCurrency(rec.gas)}</td>
                    <td>{formatCurrency(rec.water)}</td>
                    <td>{formatCurrency(rec.wastewater || 0)}</td>
                    <td><strong>{formatCurrency(rec.total)}</strong></td>
                    <td><Badge status={rec.status} /></td>
                    <td className="action-cell">
                      <div className="action-row">
                        <button className="action-btn btn-view" onClick={() => setModal({ kind: "view", record: rec })}>View</button>
                        {can(role, "edit") && (
                          <button className="action-btn btn-edit" onClick={() => setModal({ kind: "edit", record: rec })}>Edit</button>
                        )}
                      </div>
                      {can(role, "delete") && (
                        <button className="action-btn btn-delete" onClick={() => setModal({ kind: "delete", record: rec })}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Retrieve &amp; Calculate</div>
        <div className="card-sub">
          Trigger a fresh cost calculation for all active records against current budget allocations.
        </div>
        <button className="main-btn" onClick={handleRetrieve} disabled={calculating}>
          {calculating ? "Calculating..." : "Retrieve & Calculate"}
        </button>
      </div>

      <CostBreakdown
        costs={costs}
        pending={pending}
        onExportCsv={handleExportCsv}
        onExportPdf={() => window.print()}
      />

      {/* ── dialogs ── */}
      {modal?.kind === "view" && <CostViewModal record={modal.record} onClose={() => setModal(null)} />}

      {modal?.kind === "add" && (
        <CostFormModal
          departments={places.departments}
          buildings={places.buildings}
          onSubmit={handleAdd}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === "edit" && (
        <CostFormModal record={modal.record} onSubmit={handleEdit} onClose={() => setModal(null)} />
      )}

      {modal?.kind === "delete" && (
        <Modal title="Delete Cost Record" confirmLabel="Delete" danger onConfirm={() => handleDelete(modal.record)} onClose={() => setModal(null)}>
          <p>
            Are you sure you want to delete the cost record for <strong>{modal.record.scopeLabel}</strong> ({modal.record.period})?
          </p>
        </Modal>
      )}
    </FinanceLayout>
  );
}

/**
 * The page as App.jsx routes to it. ToastProvider sits here, above the page,
 * so the page's own useToast() calls can reach it.
 */
export default function FinanceCosts() {
  return (
    <ToastProvider>
      <CostsContent />
    </ToastProvider>
  );
}
