import {
  escapeHtml,
  formValues,
  formatCurrency,
  openModal,
  showFormErrors,
  showToast,
} from "../utils/ui.js";

/* ══════════════════════════════════════════════════════
   Plans Manager — EnerTrack's tier catalogue

   The one place the revenue model is configured, and small enough to hold
   in your head. Each tier is four numbers:

     base_monthly_fee       the flat fee
     included_seats         staff accounts before overage starts
     price_per_extra_seat   charged per staff account beyond that
     max_campuses           hard limit; blank means unlimited

   An invoice is base + (staff over allowance × extra-seat price) + GST.
   That is the entire model.

   Both limits are real. Seats are metered — going over bills an overage
   rather than blocking a hire, because refusing to let a client add staff
   to protect a price would be hostile. Campuses are blocked, because a
   campus is the top of the whole data hierarchy and an extra one is a step
   change in what the platform is being asked to manage.

   Editing a row here changes what every client on that tier pays from the
   next invoice generated — no redeploy, no code change. That is why the
   write routes behind this page are @Roles("Super Admin") and nothing
   wider, and why a plan has NO organization_id: the catalogue is global.
   ══════════════════════════════════════════════════════ */

export function renderPlansManager(container, app) {
  const plans = app.state.subscriptionPlans || [];
  const subs = app.state.subscriptions || [];
  const canWrite = isSuperAdmin();

  const rows = plans.map((p) => renderRow(p, subs, canWrite)).join("");
  const emptyRow = `<tr><td colspan="8"><div class="empty-state">No tiers defined.</div></td></tr>`;

  container.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Pricing tiers</h2>
          <p>
            An invoice is the tier fee, plus any staff over the seat
            allowance, plus GST. A change here takes effect on the next
            invoice generated, for every client on that tier.
          </p>
        </div>
        ${canWrite ? `<button class="btn-dark" type="button" data-action="add-plan">+ Add Tier</button>` : ""}
      </div>

      <div class="table-card">
        <div class="table-scroll">
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
                <th class="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>${rows || emptyRow}</tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  container
    .querySelector('[data-action="add-plan"]')
    ?.addEventListener("click", () => openPlanModal(app));
  container.querySelectorAll("[data-edit-plan]").forEach((b) => {
    b.addEventListener("click", () => openPlanModal(app, b.dataset.editPlan));
  });
  container.querySelectorAll("[data-retire-plan]").forEach((b) => {
    b.addEventListener("click", () => togglePlan(b.dataset.retirePlan, app));
  });
  container.querySelectorAll("[data-delete-plan]").forEach((b) => {
    b.addEventListener("click", () => deletePlan(b.dataset.deletePlan, app));
  });
}

function isSuperAdmin() {
  try {
    const u = JSON.parse(localStorage.getItem("currentUser") || "null");
    return !!u && u.role === "Super Admin";
  } catch (_) {
    return false;
  }
}

function renderRow(plan, subs, canWrite) {
  const clients = subs.filter(
    (s) => s.plan_id === plan.plan_id && s.status !== "cancelled",
  ).length;

  return `
    <tr>
      <td>
        <strong>${escapeHtml(plan.name)}</strong>
        <div class="muted-cell">${escapeHtml(plan.tagline || "")}</div>
      </td>
      <td>${formatCurrency(plan.base_monthly_fee)}</td>
      <td>${plan.included_seats}</td>
      <td>
        ${formatCurrency(plan.price_per_extra_seat)}
        <div class="muted-cell">per month, beyond the allowance</div>
      </td>
      <td>${plan.max_campuses === null ? "Unlimited" : plan.max_campuses}</td>
      <td>${clients}</td>
      <td>
        <span class="badge ${plan.is_active ? "active" : "churned"}">
          ${plan.is_active ? "Active" : "Retired"}
        </span>
      </td>
      <td class="actions-col">
        ${
          canWrite
            ? `<div class="row-actions">
                 <button class="btn-outline" type="button" data-edit-plan="${escapeHtml(plan.plan_id)}">Edit</button>
                 <button class="btn-outline" type="button" data-retire-plan="${escapeHtml(plan.plan_id)}">
                   ${plan.is_active ? "Retire" : "Reactivate"}
                 </button>
                 <button class="btn-outline btn-danger" type="button" data-delete-plan="${escapeHtml(plan.plan_id)}">Delete</button>
               </div>`
            : `<span class="muted-cell">Read only</span>`
        }
      </td>
    </tr>`;
}

function openPlanModal(app, planId = null) {
  const plan =
    (app.state.subscriptionPlans || []).find((p) => p.plan_id === planId) || null;

  openModal({
    title: plan ? "Edit Tier" : "Add Tier",
    confirmLabel: plan ? "Save Tier" : "Add Tier",
    bodyHtml: `
      <form class="form-grid">
        <div class="form-field full">
          <label for="planName">Name</label>
          <input id="planName" value="${escapeHtml(plan?.name || "")}" placeholder="Growth">
          <span class="field-error" data-error-for="name"></span>
        </div>
        <div class="form-field full">
          <label for="planTagline">Tagline</label>
          <input id="planTagline" value="${escapeHtml(plan?.tagline || "")}"
                 placeholder="Multi-campus estates with a dedicated facilities team.">
          <span class="field-error" data-error-for="tagline"></span>
        </div>
        <div class="form-field">
          <label for="planFee">Monthly fee (&#8377;)</label>
          <input id="planFee" type="number" min="0" step="1" value="${escapeHtml(plan?.base_monthly_fee ?? "")}">
          <span class="field-error" data-error-for="base_monthly_fee"></span>
        </div>
        <div class="form-field">
          <label for="planSeats">Included staff seats</label>
          <input id="planSeats" type="number" min="0" step="1" value="${escapeHtml(plan?.included_seats ?? "")}">
          <span class="field-error" data-error-for="included_seats"></span>
        </div>
        <div class="form-field">
          <label for="planExtra">Price per extra seat (&#8377;)</label>
          <input id="planExtra" type="number" min="0" step="1" value="${escapeHtml(plan?.price_per_extra_seat ?? "")}">
          <span class="field-error" data-error-for="price_per_extra_seat"></span>
        </div>
        <div class="form-field">
          <label for="planCampuses">Max campuses (blank = unlimited)</label>
          <input id="planCampuses" type="number" min="1" step="1" value="${escapeHtml(plan?.max_campuses ?? "")}">
          <span class="field-error" data-error-for="max_campuses"></span>
        </div>
        <div class="form-field full">
          <label for="planFeatures">What the tier includes (one per line)</label>
          <textarea id="planFeatures" rows="4">${escapeHtml((plan?.features || []).join("\n"))}</textarea>
          <span class="field-error" data-error-for="features"></span>
        </div>
      </form>
      <p class="muted-cell" style="margin-top:10px">
        A Campus Visitor never counts towards a seat. A campus may have
        thousands of students reporting problems, and billing per student
        would punish the client for opening the product up to the people who
        spot faults first.
      </p>`,
    onConfirm: (modal) => {
      const vals = formValues(modal, {
        name: "#planName",
        tagline: "#planTagline",
        base_monthly_fee: "#planFee",
        included_seats: "#planSeats",
        price_per_extra_seat: "#planExtra",
        max_campuses: "#planCampuses",
        features: "#planFeatures",
      });

      const errors = {};
      if (!vals.name || vals.name.length < 3)
        errors.name = "Enter a tier name (min 3 chars).";
      if (!vals.tagline) errors.tagline = "Describe the tier in one line.";

      for (const key of [
        "base_monthly_fee",
        "included_seats",
        "price_per_extra_seat",
      ]) {
        if (vals[key] === "" || Number(vals[key]) < 0)
          errors[key] = "Enter a number of zero or more.";
      }
      if (vals.max_campuses !== "" && Number(vals.max_campuses) < 1)
        errors.max_campuses = "Leave blank for unlimited, or enter 1 or more.";

      if (Object.keys(errors).length) {
        showFormErrors(modal, errors);
        return false;
      }

      const payload = {
        name: vals.name,
        tagline: vals.tagline,
        base_monthly_fee: Number(vals.base_monthly_fee),
        included_seats: Number(vals.included_seats),
        price_per_extra_seat: Number(vals.price_per_extra_seat),
        max_campuses:
          vals.max_campuses === "" ? null : Number(vals.max_campuses),
        features: vals.features
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      };

      app.update(async (state) => {
        try {
          if (planId) {
            await window.api.patch("/subscription-plans/" + planId, payload);
          } else {
            await window.api.post("/subscription-plans", payload);
          }
          state.subscriptionPlans = await window.api.get("/subscription-plans");
        } catch (err) {
          console.error("Tier save failed:", err);
          showToast(err.message || "Could not save tier.", "error");
        }
      }, plan ? "Tier updated — effective from the next invoice." : "Tier added.");
      return true;
    },
  });
}

/**
 * Retiring is the safe way to withdraw a tier: existing contracts keep
 * billing on it, it drops out of the public catalogue, and nothing that
 * references it breaks.
 */
function togglePlan(planId, app) {
  const plan = (app.state.subscriptionPlans || []).find((p) => p.plan_id === planId);
  if (!plan) return;

  app.update(async (state) => {
    try {
      await window.api.patch("/subscription-plans/" + planId, {
        is_active: !plan.is_active,
      });
      state.subscriptionPlans = await window.api.get("/subscription-plans");
    } catch (err) {
      console.error("Tier retire failed:", err);
      showToast(err.message || "Could not change tier status.", "error");
    }
  }, plan.is_active ? "Tier retired." : "Tier reactivated.");
}

function deletePlan(planId, app) {
  const plan = (app.state.subscriptionPlans || []).find((p) => p.plan_id === planId);
  if (!plan) return;

  openModal({
    title: "Delete Tier",
    // The backend refuses while any subscription still points at the tier,
    // so this warning describes a rule that is genuinely enforced server side.
    bodyHtml: `<p>Delete <strong>${escapeHtml(plan.name)}</strong>?</p>
               <p class="muted-cell">
                 A tier still used by a contract cannot be deleted — the
                 billing engine would fail to resolve it. Retire it instead.
               </p>`,
    confirmLabel: "Delete",
    danger: true,
    onConfirm: () => {
      app.update(async (state) => {
        try {
          await window.api.delete("/subscription-plans/" + planId);
          state.subscriptionPlans = await window.api.get("/subscription-plans");
        } catch (err) {
          console.error("Tier delete failed:", err);
          showToast(err.message || "Could not delete tier.", "error");
        }
      }, "Tier deleted.");
      return true;
    },
  });
}
