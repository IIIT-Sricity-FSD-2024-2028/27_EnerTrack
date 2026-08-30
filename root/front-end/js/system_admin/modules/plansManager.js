import {
  escapeHtml,
  formValues,
  formatCurrency,
  openModal,
  showFormErrors,
  showToast,
} from "../utils/ui.js";

/* ══════════════════════════════════════════════════════
   Plans Manager — EnerTrack's price catalogue

   This is the single most consequential table in the product, and the one
   place the revenue model is actually configured. Every figure the billing
   engine uses lives on a row here:

     price_per_meter_month          the recurring fee, per metered point
     min_monthly_fee                the floor, so a tiny estate still pays
     audit_fee_base / _per_sqm      the one-time site assessment
     performance_share_pct          the cut of verified savings
     share_cap_pct_of_subscription  the ceiling on that cut

   Editing a row here changes what every client on that tier is billed from
   the next invoice generated — no redeploy, no code change. That is the
   whole scalability argument, and it is why the write routes behind this
   page are @Roles("Super Admin") and nothing wider.

   A plan has NO organization_id: the catalogue is global, identical for
   every tenant, so unlike every other table in the admin area this one is
   not tenant-scoped at all.
   ══════════════════════════════════════════════════════ */

export function renderPlansManager(container, app) {
  const plans = app.state.subscriptionPlans || [];
  const subs = app.state.subscriptions || [];
  const canWrite = isSuperAdmin();

  const rows = plans.map((p) => renderRow(p, subs, canWrite)).join("");
  const emptyRow = `<tr><td colspan="9"><div class="empty-state">No subscription plans defined.</div></td></tr>`;

  container.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Pricing plans</h2>
          <p>
            EnerTrack's price catalogue. A change here takes effect on the next
            invoice generated, for every client on that tier.
          </p>
        </div>
        ${canWrite ? `<button class="btn-dark" type="button" data-action="add-plan">+ Add Plan</button>` : ""}
      </div>

      <div class="table-card">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th>Per meter / mo</th>
                <th>Minimum / mo</th>
                <th>Audit fee</th>
                <th>Share</th>
                <th>Share cap</th>
                <th>Subscribers</th>
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
  const subscribers = subs.filter(
    (s) => s.plan_id === plan.plan_id && s.status !== "cancelled",
  ).length;

  return `
    <tr>
      <td>
        <strong>${escapeHtml(plan.name)}</strong>
        <div class="muted-cell">${escapeHtml(plan.tagline || "")}</div>
      </td>
      <td>${formatCurrency(plan.price_per_meter_month)}</td>
      <td>${formatCurrency(plan.min_monthly_fee)}</td>
      <td>
        ${formatCurrency(plan.audit_fee_base)}
        <div class="muted-cell">+ ${formatCurrency(plan.audit_fee_per_sqm)} / m&sup2;</div>
      </td>
      <td>${plan.performance_share_pct}%</td>
      <td>
        ${plan.share_cap_pct_of_subscription}%
        <div class="muted-cell">of subscription</div>
      </td>
      <td>${subscribers}</td>
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
    title: plan ? "Edit Plan" : "Add Plan",
    confirmLabel: plan ? "Save Plan" : "Add Plan",
    bodyHtml: `
      <form class="form-grid">
        <div class="form-field full">
          <label for="planName">Name</label>
          <input id="planName" value="${escapeHtml(plan?.name || "")}" placeholder="Professional">
          <span class="field-error" data-error-for="name"></span>
        </div>
        <div class="form-field full">
          <label for="planTagline">Tagline</label>
          <input id="planTagline" value="${escapeHtml(plan?.tagline || "")}"
                 placeholder="Full workflow, verified savings and account management.">
          <span class="field-error" data-error-for="tagline"></span>
        </div>
        <div class="form-field">
          <label for="planPerMeter">Price per meter / month (&#8377;)</label>
          <input id="planPerMeter" type="number" min="0" step="1" value="${escapeHtml(plan?.price_per_meter_month ?? "")}">
          <span class="field-error" data-error-for="price_per_meter_month"></span>
        </div>
        <div class="form-field">
          <label for="planMinFee">Minimum monthly fee (&#8377;)</label>
          <input id="planMinFee" type="number" min="0" step="1" value="${escapeHtml(plan?.min_monthly_fee ?? "")}">
          <span class="field-error" data-error-for="min_monthly_fee"></span>
        </div>
        <div class="form-field">
          <label for="planAuditBase">Audit fee, base (&#8377;)</label>
          <input id="planAuditBase" type="number" min="0" step="1" value="${escapeHtml(plan?.audit_fee_base ?? "")}">
          <span class="field-error" data-error-for="audit_fee_base"></span>
        </div>
        <div class="form-field">
          <label for="planAuditSqm">Audit fee, per m&sup2; (&#8377;)</label>
          <input id="planAuditSqm" type="number" min="0" step="0.5" value="${escapeHtml(plan?.audit_fee_per_sqm ?? "")}">
          <span class="field-error" data-error-for="audit_fee_per_sqm"></span>
        </div>
        <div class="form-field">
          <label for="planShare">Performance share (%)</label>
          <input id="planShare" type="number" min="0" max="100" step="0.5" value="${escapeHtml(plan?.performance_share_pct ?? "")}">
          <span class="field-error" data-error-for="performance_share_pct"></span>
        </div>
        <div class="form-field">
          <label for="planCap">Share cap (% of subscription)</label>
          <input id="planCap" type="number" min="0" step="10" value="${escapeHtml(plan?.share_cap_pct_of_subscription ?? "")}">
          <span class="field-error" data-error-for="share_cap_pct_of_subscription"></span>
        </div>
        <div class="form-field full">
          <label for="planFeatures">Features (one per line)</label>
          <textarea id="planFeatures" rows="4">${escapeHtml((plan?.features || []).join("\n"))}</textarea>
          <span class="field-error" data-error-for="features"></span>
        </div>
      </form>
      <p class="muted-cell" style="margin-top:10px">
        The share cap bounds the performance-share line as a multiple of that
        period's subscription fee, so an unusual season cannot produce an
        invoice a client could not have budgeted for.
      </p>`,
    onConfirm: (modal) => {
      const vals = formValues(modal, {
        name: "#planName",
        tagline: "#planTagline",
        price_per_meter_month: "#planPerMeter",
        min_monthly_fee: "#planMinFee",
        audit_fee_base: "#planAuditBase",
        audit_fee_per_sqm: "#planAuditSqm",
        performance_share_pct: "#planShare",
        share_cap_pct_of_subscription: "#planCap",
        features: "#planFeatures",
      });

      const errors = {};
      if (!vals.name || vals.name.length < 3)
        errors.name = "Enter a plan name (min 3 chars).";
      if (!vals.tagline) errors.tagline = "Describe the tier in one line.";

      for (const key of [
        "price_per_meter_month",
        "min_monthly_fee",
        "audit_fee_base",
        "audit_fee_per_sqm",
        "performance_share_pct",
        "share_cap_pct_of_subscription",
      ]) {
        if (vals[key] === "" || Number(vals[key]) < 0)
          errors[key] = "Enter a number of zero or more.";
      }
      if (Number(vals.performance_share_pct) > 100)
        errors.performance_share_pct = "A share above 100% of savings is not a share.";

      if (Object.keys(errors).length) {
        showFormErrors(modal, errors);
        return false;
      }

      const payload = {
        name: vals.name,
        tagline: vals.tagline,
        price_per_meter_month: Number(vals.price_per_meter_month),
        min_monthly_fee: Number(vals.min_monthly_fee),
        audit_fee_base: Number(vals.audit_fee_base),
        audit_fee_per_sqm: Number(vals.audit_fee_per_sqm),
        performance_share_pct: Number(vals.performance_share_pct),
        share_cap_pct_of_subscription: Number(vals.share_cap_pct_of_subscription),
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
          console.error("Plan save failed:", err);
          showToast(err.message || "Could not save plan.", "error");
        }
      }, plan ? "Plan updated — effective from the next invoice." : "Plan added.");
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
      console.error("Plan retire failed:", err);
      showToast(err.message || "Could not change plan status.", "error");
    }
  }, plan.is_active ? "Plan retired." : "Plan reactivated.");
}

function deletePlan(planId, app) {
  const plan = (app.state.subscriptionPlans || []).find((p) => p.plan_id === planId);
  if (!plan) return;

  openModal({
    title: "Delete Plan",
    // The backend refuses while any subscription still points at the plan,
    // so this warning describes a rule that is genuinely enforced server side.
    bodyHtml: `<p>Delete <strong>${escapeHtml(plan.name)}</strong>?</p>
               <p class="muted-cell">
                 A plan still used by a subscription cannot be deleted — the
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
          console.error("Plan delete failed:", err);
          showToast(err.message || "Could not delete plan.", "error");
        }
      }, "Plan deleted.");
      return true;
    },
  });
}
