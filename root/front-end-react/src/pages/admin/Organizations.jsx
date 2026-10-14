/**
 * Organizations — /admin/organizations ("Organisations"). Super Admin only.
 * Replaces js/system_admin/modules/organizationsManager.js.
 *
 * An organisation is a client: the customer EnerTrack holds a contract
 * with. Campuses, buildings and meters all hang beneath one. This page lists
 * them with their campus count, and adds, edits and deletes them.
 *
 * (The original also had a read-only view for an Organization Admin, but its
 * own tab rule never let one open this tab, so that view is left out.)
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import AdminPage from "./AdminPage";
import Modal from "./Modal";
import { addToast, formatCurrency, formatLabel } from "./adminHelpers";

const STATUSES = ["prospect", "audited", "active", "churned"];

export default function Organizations() {
  const [organizations, setOrganizations] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  // The open popup: null, or { type: "add" | "edit" | "delete", org }
  const [modal, setModal] = useState(null);

  // Load the organisations, and the campuses to count per organisation
  useEffect(() => {
    Promise.all([api.get("/organizations"), api.get("/campus")])
      .then(([orgList, campusList]) => {
        setOrganizations(Array.isArray(orgList) ? orgList : []);
        setCampuses(Array.isArray(campusList) ? campusList : []);
      })
      .catch(() => {
        addToast(setToasts, "Failed to load data from backend.", "error");
      })
      .finally(() => setLoading(false));
  }, []);

  async function reloadOrganizations() {
    const list = await api.get("/organizations").catch(() => organizations);
    setOrganizations(Array.isArray(list) ? list : organizations);
  }

  // Called by <OrgFormModal> with the organisation to save
  async function handleSave(payload) {
    const editing = modal.org; // null when adding
    setModal(null);
    try {
      if (editing) {
        await api.patch("/organizations/" + editing.organization_id, payload);
      } else {
        await api.post("/organizations", payload);
      }
      await reloadOrganizations();
      addToast(
        setToasts,
        editing ? "Organisation updated." : "Organisation added.",
        "success",
      );
    } catch (err) {
      addToast(
        setToasts,
        err.message || "Could not save organisation.",
        "error",
      );
    }
  }

  async function handleDelete(org) {
    setModal(null);
    try {
      await api.delete("/organizations/" + org.organization_id);
      await reloadOrganizations();
      addToast(setToasts, "Organisation deleted.", "success");
    } catch (err) {
      // e.g. the backend refuses while the organisation still owns campuses
      addToast(
        setToasts,
        err.message || "Could not delete organisation.",
        "error",
      );
    }
  }

  return (
    <AdminPage
      subtitle="Client organisations. Each one is a separate tenant with its own isolated data."
      requiredRole="Super Admin"
      loading={loading}
      toasts={toasts}
    >
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Organisations</h2>
            <p>
              Every client organisation on the platform. Each one is an isolated
              tenant.
            </p>
          </div>
          <button
            className="btn-dark"
            type="button"
            onClick={() => setModal({ type: "add", org: null })}
          >
            + Add Organisation
          </button>
        </div>

        <div className="table-card">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Floor area</th>
                  <th>Tariff</th>
                  <th>Campuses</th>
                  <th className="actions-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="empty-state">No organisations found.</div>
                    </td>
                  </tr>
                ) : (
                  organizations.map((org) => {
                    const status = org.status || "prospect";
                    // How many of the loaded campuses belong to this one
                    const campusCount = campuses.filter(
                      (c) => c.organization_id === org.organization_id,
                    ).length;

                    return (
                      <tr key={org.organization_id}>
                        <td>
                          <strong>{org.name}</strong>
                          <div className="muted-cell">
                            {org.organization_id}
                          </div>
                        </td>
                        <td>{org.type || "-"}</td>
                        <td>{org.location || "-"}</td>
                        <td>
                          <span className={`badge ${status}`}>
                            {formatLabel(status)}
                          </span>
                        </td>
                        <td>
                          {org.floor_area_sqm
                            ? Number(org.floor_area_sqm).toLocaleString(
                                "en-IN",
                              ) + " m²"
                            : "-"}
                        </td>
                        <td>
                          {org.tariff_rate
                            ? formatCurrency(org.tariff_rate) + " /unit"
                            : "-"}
                        </td>
                        <td>{campusCount}</td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-btn"
                              type="button"
                              onClick={() => setModal({ type: "edit", org })}
                            >
                              Edit
                            </button>
                            <button
                              className="icon-btn btn-danger"
                              type="button"
                              onClick={() => setModal({ type: "delete", org })}
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
        <OrgFormModal
          org={modal.org}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "delete" && (
        <Modal
          title="Delete Organisation"
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(modal.org)}
          onClose={() => setModal(null)}
        >
          <p>
            Delete <strong>{modal.org.name}</strong>?
          </p>
          <p className="muted-cell">
            An organisation that still owns campuses cannot be deleted.
          </p>
        </Modal>
      )}
    </AdminPage>
  );
}

/* ── Add / Edit Organisation form (a controlled form inside <Modal>) ── */

function OrgFormModal({ org, onSave, onClose }) {
  const isEdit = org !== null;
  const [form, setForm] = useState({
    name: org?.name || "",
    type: org?.type || "",
    location: org?.location || "",
    status: org?.status || "prospect",
    floor_area_sqm: org?.floor_area_sqm ?? "",
    tariff_rate: org?.tariff_rate ?? "",
    contract_start: org?.contract_start || "",
  });
  const [errors, setErrors] = useState({});

  function handleChange(event) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  function handleConfirm() {
    const name = form.name.trim();
    const type = form.type.trim();
    const area = String(form.floor_area_sqm).trim();
    const tariff = String(form.tariff_rate).trim();

    const newErrors = {};
    if (name.length < 3) {
      newErrors.name = "Enter an organisation name (min 3 chars).";
    }
    if (!type) newErrors.type = "Enter a type, for example University.";
    if (area !== "" && Number(area) < 0) {
      newErrors.floor_area_sqm = "Enter a positive number.";
    }
    if (tariff !== "" && Number(tariff) < 0) {
      newErrors.tariff_rate = "Enter a positive number.";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors); // the popup stays open, showing what is wrong
      return;
    }

    onSave({
      name: name,
      type: type,
      location: form.location.trim() || null,
      // A new organisation always starts as a prospect: its status then
      // moves on its own as EnerTrack's proposal goes out and is accepted.
      status: isEdit ? form.status : "prospect",
      floor_area_sqm: area === "" ? null : Number(area),
      tariff_rate: tariff === "" ? null : Number(tariff),
      contract_start: form.contract_start || null,
    });
  }

  return (
    <Modal
      title={isEdit ? "Edit Organisation" : "Add Organisation"}
      confirmLabel={isEdit ? "Save Organisation" : "Add Organisation"}
      onConfirm={handleConfirm}
      onClose={onClose}
    >
      <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
        <div className="form-field full">
          <label htmlFor="orgName">Name</label>
          <input
            id="orgName"
            name="name"
            placeholder="Riverside Polytechnic"
            value={form.name}
            onChange={handleChange}
          />
          <span className="field-error">{errors.name}</span>
        </div>

        <div className="form-field">
          <label htmlFor="orgType">Type</label>
          <input
            id="orgType"
            name="type"
            placeholder="University"
            value={form.type}
            onChange={handleChange}
          />
          <span className="field-error">{errors.type}</span>
        </div>

        <div className="form-field">
          <label htmlFor="orgLocation">Location</label>
          <input
            id="orgLocation"
            name="location"
            placeholder="Pune, Maharashtra"
            value={form.location}
            onChange={handleChange}
          />
          <span className="field-error">{errors.location}</span>
        </div>

        {isEdit && (
          <div className="form-field">
            <label htmlFor="orgStatus">Status</label>
            <select
              id="orgStatus"
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="field-error">{errors.status}</span>
          </div>
        )}

        <div className="form-field">
          <label htmlFor="orgArea">Floor area (m²)</label>
          <input
            id="orgArea"
            name="floor_area_sqm"
            type="number"
            min="0"
            step="1"
            value={form.floor_area_sqm}
            onChange={handleChange}
          />
          <span className="field-error">{errors.floor_area_sqm}</span>
        </div>

        <div className="form-field">
          <label htmlFor="orgTariff">Tariff rate (per unit)</label>
          <input
            id="orgTariff"
            name="tariff_rate"
            type="number"
            min="0"
            step="0.01"
            value={form.tariff_rate}
            onChange={handleChange}
          />
          <span className="field-error">{errors.tariff_rate}</span>
        </div>

        <div className="form-field">
          <label htmlFor="orgContract">Contract start</label>
          <input
            id="orgContract"
            name="contract_start"
            type="date"
            value={form.contract_start}
            onChange={handleChange}
          />
          <span className="field-error">{errors.contract_start}</span>
        </div>
      </form>
    </Modal>
  );
}
