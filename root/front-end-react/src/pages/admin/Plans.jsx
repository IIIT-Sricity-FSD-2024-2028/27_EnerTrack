/**
 * Plans — /admin/plans ("Pricing Plans"). Super Admin only.
 * Replaces js/system_admin/modules/plansManager.js.
 *
 * EnerTrack's tier catalogue. Each tier is four numbers: the monthly fee,
 * how many staff seats are included, the price of each extra seat, and the
 * most campuses allowed (blank = unlimited). An invoice is the fee, plus
 * staff over the allowance x the extra-seat price, plus GST.
 *
 * Editing a tier changes what every client on it pays from the next invoice.
 * Retiring one hides it from new clients without breaking existing contracts.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import AdminPage from "./AdminPage";
import Modal from "./Modal";
import { addToast, formatCurrency } from "./adminHelpers";

export default function Plans() {
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  // The open popup: null, or { type: "add" | "edit" | "delete", plan }
  const [modal, setModal] = useState(null);

  // Load the tiers, and the contracts to count clients per tier
  useEffect(() => {
    Promise.all([api.get("/subscription-plans"), api.get("/subscriptions")])
      .then(([planList, subList]) => {
        setPlans(Array.isArray(planList) ? planList : []);
        setSubscriptions(Array.isArray(subList) ? subList : []);
      })
      .catch(() => {
        addToast(setToasts, "Failed to load data from backend.", "error");
      })
      .finally(() => setLoading(false));
  }, []);

  async function reloadPlans() {
    const list = await api.get("/subscription-plans").catch(() => plans);
    setPlans(Array.isArray(list) ? list : plans);
  }

  // Called by <PlanFormModal> with the tier to save
  async function handleSave(payload) {
    const editing = modal.plan; // null when adding
    setModal(null);
    try {
      if (editing) {
        await api.patch("/subscription-plans/" + editing.plan_id, payload);
      } else {
        await api.post("/subscription-plans", payload);
      }
      await reloadPlans();
      addToast(
        setToasts,
        editing
          ? "Tier updated — effective from the next invoice."
          : "Tier added.",
        "success",
      );
    } catch (err) {
      addToast(setToasts, err.message || "Could not save tier.", "error");
    }
  }

  // Retire / Reactivate: one click, no popup
  async function handleToggle(plan) {
    try {
      await api.patch("/subscription-plans/" + plan.plan_id, {
        is_active: !plan.is_active,
      });
      await reloadPlans();
      addToast(
        setToasts,
        plan.is_active ? "Tier retired." : "Tier reactivated.",
        "success",
      );
    } catch (err) {
      addToast(
        setToasts,
        err.message || "Could not change tier status.",
        "error",
      );
    }
  }

  async function handleDelete(plan) {
    setModal(null);
    try {
      await api.delete("/subscription-plans/" + plan.plan_id);
      await reloadPlans();
      addToast(setToasts, "Tier deleted.", "success");
    } catch (err) {
      // e.g. the backend refuses while a contract still uses the tier
      addToast(setToasts, err.message || "Could not delete tier.", "error");
    }
  }

  return (
    <AdminPage
      subtitle="EnerTrack's price catalogue. Every figure the billing engine uses lives on these rows."
      requiredRole="Super Admin"
      loading={loading}
      toasts={toasts}
    >
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Pricing tiers</h2>
            <p>
              An invoice is the tier fee, plus any staff over the seat
              allowance, plus GST. A change here takes effect on the next
              invoice generated, for every client on that tier.
            </p>
          </div>
          <button
            className="btn-dark"
            type="button"
            onClick={() => setModal({ type: "add", plan: null })}
          >
            + Add Tier
          </button>
        </div>

        <div className="table-card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Tier</th>
                  <th>Monthly fee</th>
                  <th>Included staff</th>
                  <th>Extra seat</th>
                  <th>Campuses</th>
                  <th>Clients</th>
                  <th>Status</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="empty-state">No tiers defined.</div>
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => {
                    // Clients on this tier = its contracts not cancelled
                    const clients = subscriptions.filter(
                      (s) =>
                        s.plan_id === plan.plan_id && s.status !== "cancelled",
                    ).length;

                    return (
                      <tr key={plan.plan_id}>
                        <td>
                          <strong>{plan.name}</strong>
                          <div className="muted-cell">{plan.tagline || ""}</div>
                        </td>
                        <td>{formatCurrency(plan.base_monthly_fee)}</td>
                        <td>{plan.included_seats}</td>
                        <td>
                          {formatCurrency(plan.price_per_extra_seat)}
                          <div className="muted-cell">
                            per month, beyond the allowance
                          </div>
                        </td>
                        <td>
                          {plan.max_campuses === null
                            ? "Unlimited"
                            : plan.max_campuses}
                        </td>
                        <td>{clients}</td>
                        <td>
                          <span
                            className={
                              plan.is_active ? "badge active" : "badge churned"
                            }
                          >
                            {plan.is_active ? "Active" : "Retired"}
                          </span>
                        </td>
                        <td className="actions-col">
                          <div className="row-actions">
                            <button
                              className="btn-outline"
                              type="button"
                              onClick={() => setModal({ type: "edit", plan })}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-outline"
                              type="button"
                              onClick={() => handleToggle(plan)}
                            >
                              {plan.is_active ? "Retire" : "Reactivate"}
                            </button>
                            <button
                              className="btn-outline btn-danger"
                              type="button"
                              onClick={() => setModal({ type: "delete", plan })}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Popups (only one is open at a time) ── */}
      {(modal?.type === "add" || modal?.type === "edit") && (
        <PlanFormModal
          plan={modal.plan}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "delete" && (
        <Modal
          title="Delete Tier"
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(modal.plan)}
          onClose={() => setModal(null)}
        >
          <p>
            Delete <strong>{modal.plan.name}</strong>?
          </p>
          <p className="muted-cell">
            A tier still used by a contract cannot be deleted — the billing
            engine would fail to resolve it. Retire it instead.
          </p>
        </Modal>
      )}
    </AdminPage>
  );
}

/* ── Add / Edit Tier form (a controlled form inside <Modal>) ── */

function PlanFormModal({ plan, onSave, onClose }) {
  const isEdit = plan !== null;
  const [form, setForm] = useState({
    name: plan?.name || "",
    tagline: plan?.tagline || "",
    base_monthly_fee: plan?.base_monthly_fee ?? "",
    included_seats: plan?.included_seats ?? "",
    price_per_extra_seat: plan?.price_per_extra_seat ?? "",
    max_campuses: plan?.max_campuses ?? "",
    features: (plan?.features || []).join("\n"), // one per line
  });
  const [errors, setErrors] = useState({});

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  function handleConfirm() {
    // The original trimmed every value before checking
    const values = {};
    Object.keys(form).forEach((key) => {
      values[key] = String(form[key]).trim();
    });

    const newErrors = {};
    if (values.name.length < 3) {
      newErrors.name = "Enter a tier name (min 3 chars).";
    }
    if (!values.tagline) newErrors.tagline = "Describe the tier in one line.";
    ["base_monthly_fee", "included_seats", "price_per_extra_seat"].forEach(
      (key) => {
        if (values[key] === "" || Number(values[key]) < 0) {
          newErrors[key] = "Enter a number of zero or more.";
        }
      },
    );
    if (values.max_campuses !== "" && Number(values.max_campuses) < 1) {
      newErrors.max_campuses = "Leave blank for unlimited, or enter 1 or more.";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors); // the popup stays open, showing what is wrong
      return;
    }

    onSave({
      name: values.name,
      tagline: values.tagline,
      base_monthly_fee: Number(values.base_monthly_fee),
      included_seats: Number(values.included_seats),
      price_per_extra_seat: Number(values.price_per_extra_seat),
      max_campuses:
        values.max_campuses === "" ? null : Number(values.max_campuses),
      // One feature per line; blank lines dropped
      features: values.features
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    });
  }

  return (
    <Modal
      title={isEdit ? "Edit Tier" : "Add Tier"}
      confirmLabel={isEdit ? "Save Tier" : "Add Tier"}
      onConfirm={handleConfirm}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
        <div className="form-field full">
          <label htmlFor="planName">Name</label>
          <input
            id="planName"
            name="name"
            placeholder="Growth"
            value={form.name}
            onChange={handleChange}
          />
          <span className="field-error">{errors.name}</span>
        </div>

        <div className="form-field full">
          <label htmlFor="planTagline">Tagline</label>
          <input
            id="planTagline"
            name="tagline"
            placeholder="Multi-campus estates with a dedicated facilities team."
            value={form.tagline}
            onChange={handleChange}
          />
          <span className="field-error">{errors.tagline}</span>
        </div>

        <div className="form-field">
          <label htmlFor="planFee">Monthly fee (₹)</label>
          <input
            id="planFee"
            name="base_monthly_fee"
            type="number"
            min="0"
            step="1"
            value={form.base_monthly_fee}
            onChange={handleChange}
          />
          <span className="field-error">{errors.base_monthly_fee}</span>
        </div>

        <div className="form-field">
          <label htmlFor="planSeats">Included staff seats</label>
          <input
            id="planSeats"
            name="included_seats"
            type="number"
            min="0"
            step="1"
            value={form.included_seats}
            onChange={handleChange}
          />
          <span className="field-error">{errors.included_seats}</span>
        </div>

        <div className="form-field">
          <label htmlFor="planExtra">Price per extra seat (₹)</label>
          <input
            id="planExtra"
            name="price_per_extra_seat"
            type="number"
            min="0"
            step="1"
            value={form.price_per_extra_seat}
            onChange={handleChange}
          />
          <span className="field-error">{errors.price_per_extra_seat}</span>
        </div>

        <div className="form-field">
          <label htmlFor="planCampuses">Max campuses (blank = unlimited)</label>
          <input
            id="planCampuses"
            name="max_campuses"
            type="number"
            min="1"
            step="1"
            value={form.max_campuses}
            onChange={handleChange}
          />
          <span className="field-error">{errors.max_campuses}</span>
        </div>

        <div className="form-field full">
          <label htmlFor="planFeatures">
            What the tier includes (one per line)
          </label>
          <textarea
            id="planFeatures"
            name="features"
            rows="4"
            value={form.features}
            onChange={handleChange}
          ></textarea>
          <span className="field-error">{errors.features}</span>
        </div>
      </form>

      <p className="muted-cell" style={{ marginTop: "10px" }}>
        A Campus Visitor never counts towards a seat. A campus may have
        thousands of students reporting problems, and billing per student would
        punish the client for opening the product up to the people who spot
        faults first.
      </p>
    </Modal>
  );
}
