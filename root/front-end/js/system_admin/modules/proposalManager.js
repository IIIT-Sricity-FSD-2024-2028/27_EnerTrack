import { escapeHtml, formatCurrency, openModal, showToast } from "../utils/ui.js";

/* ══════════════════════════════════════════════════════
   Proposal — the client's side of the sales workflow

   An Organization Admin is the first account created for any organisation,
   which makes them its account owner and the person an auditor's proposal
   is addressed to. This tab is where they answer it.

   Three answers, and the difference between them matters:

     Accept          creates the subscription and turns the service on
     Request changes keeps the proposal open with a note attached, so the
                     auditor revises rather than starting again
     Decline         closes it, and is kept as a state so conversion stays
                     reportable rather than quietly vanishing

   Everything here is one call to the backend, which owns every rule: it
   refuses a tier too small for the estate, refuses a second live
   subscription, and stamps the dates itself.
   ══════════════════════════════════════════════════════ */

export function renderProposalManager(container, app) {
  const audits = app.state.audits || [];
  const plans = app.state.subscriptionPlans || [];

  // A client sees only its own audits — scopeToTenant already narrowed them.
  const open = audits.filter(
    (a) => a.proposal && (a.status === "proposed" || a.status === "changes-requested"),
  );
  const settled = audits.filter(
    (a) => a.proposal && (a.status === "accepted" || a.status === "declined"),
  );

  const planName = (id) => plans.find((p) => p.plan_id === id)?.name ?? id;
  const planOf = (id) => plans.find((p) => p.plan_id === id);

  container.innerHTML = `
    <section class="panel">
      <div class="panel-header">
        <div>
          <h2>Proposal from EnerTrack</h2>
          <p>
            What your certified auditor recommends for your organisation, and
            what it would cost. Accepting starts your subscription.
          </p>
        </div>
      </div>

      ${renderStage(audits)}

      ${open.map((a) => renderOpen(a, planOf(a.proposal.recommended_plan_id), app)).join("")}
      ${settled.length ? renderHistory(settled, planName) : ""}
    </section>`;

  container.querySelector("[data-request-audit]")?.addEventListener("click", () =>
    requestAudit(app),
  );
  container.querySelectorAll("[data-accept]").forEach((b) => {
    b.addEventListener("click", () => respond(b.dataset.accept, "accept", app));
  });
  container.querySelectorAll("[data-changes]").forEach((b) => {
    b.addEventListener("click", () => respond(b.dataset.changes, "request-changes", app));
  });
  container.querySelectorAll("[data-decline]").forEach((b) => {
    b.addEventListener("click", () => respond(b.dataset.decline, "decline", app));
  });
}

/**
 * Where this organisation is in the engagement, and what to do about it.
 *
 * The first state is the important one: an organisation that has never asked
 * for an audit has nothing else on this page, so the request button IS the
 * page. Everything downstream — survey, recommendations, proposal,
 * subscription — hangs off that one click.
 */
function renderStage(audits) {
  const open = audits.find(
    (a) => a.status === "scheduled" || a.status === "in-progress",
  );
  const answered = audits.some((a) => a.proposal);

  if (open) {
    return `
      <div class="table-card" style="padding:20px;margin-bottom:16px">
        <h3 style="font-size:16px;margin-bottom:4px">
          ${open.status === "scheduled" ? "Audit requested" : "Audit underway"}
        </h3>
        <p class="muted-cell">
          ${
            open.status === "scheduled"
              ? "A certified energy auditor has been assigned and will be in touch to arrange the site visit."
              : "Your auditor is writing up the site survey. A proposal follows once they are done."
          }
        </p>
      </div>`;
  }

  if (answered) return "";

  return `
    <div class="table-card" style="padding:24px;margin-bottom:16px">
      <h3 style="font-size:17px;margin-bottom:6px">Start with a site audit</h3>
      <p class="muted-cell" style="max-width:60ch;line-height:1.6">
        A certified energy auditor visits your campus, records what metering
        you already have, and writes up where the savings are — each measure
        with its cost, its saving and its payback. You then get one proposal
        with the recommended tier and what it costs.
      </p>
      <p class="muted-cell" style="margin-top:10px">
        Nothing is charged until you accept that proposal.
      </p>
      <button class="btn-dark" type="button" data-request-audit style="margin-top:16px">
        Request an energy audit
      </button>
    </div>`;
}

function renderOpen(audit, plan, app) {
  const p = audit.proposal;
  const findings = audit.findings || [];
  const saving = findings.reduce((sum, f) => sum + (f.est_annual_saving || 0), 0);
  const awaitingRevision = audit.status === "changes-requested";

  return `
    <div class="table-card" style="padding:20px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
        <div>
          <h3 style="font-size:18px;margin-bottom:4px">
            ${escapeHtml(plan?.name ?? p.recommended_plan_id)}
          </h3>
          <p class="muted-cell">${escapeHtml(plan?.tagline ?? "")}</p>
        </div>
        <div style="text-align:right">
          <div style="font-size:26px;font-weight:700">${formatCurrency(p.monthly_estimate)}</div>
          <div class="muted-cell">per month, before GST</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:20px">
        ${fact("Staff counted on site", `${p.estimated_staff}`, plan ? `${plan.included_seats} included in this tier` : "")}
        ${fact("Campuses", `${p.estimated_campuses}`, plan ? (plan.max_campuses === null ? "unlimited in this tier" : `${plan.max_campuses} allowed`) : "")}
        ${fact("Savings identified", formatCurrency(saving), `${findings.length} recommendation(s) from the audit`)}
      </div>

      ${
        (plan?.features || []).length
          ? `<div style="margin-top:18px">
               <div class="muted-cell" style="text-transform:uppercase;letter-spacing:.04em;font-size:11px;font-weight:700;margin-bottom:8px">
                 What is included
               </div>
               <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7">
                 ${plan.features.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
               </ul>
             </div>`
          : ""
      }

      ${
        awaitingRevision
          ? `<p class="muted-cell" style="margin-top:18px;padding:10px 12px;background:#fef3c7;border-radius:6px">
               You asked for changes on ${escapeHtml(p.responded_on ?? "")}:
               &ldquo;${escapeHtml(p.response_note ?? "")}&rdquo;
               <br>Waiting on a revised proposal from your auditor.
             </p>`
          : `<p class="muted-cell" style="margin-top:18px">
               This is an estimate based on what the auditor counted. Your first
               invoice bills your actual staff count, so it may differ slightly.
             </p>
             <div class="row-actions" style="margin-top:14px">
               <button class="btn-dark" type="button" data-accept="${escapeHtml(audit.audit_id)}">
                 Accept and start subscription
               </button>
               <button class="btn-outline" type="button" data-changes="${escapeHtml(audit.audit_id)}">
                 Request changes
               </button>
               <button class="btn-outline btn-danger" type="button" data-decline="${escapeHtml(audit.audit_id)}">
                 Decline
               </button>
             </div>`
      }
    </div>`;
}

function fact(label, value, note) {
  return `
    <div>
      <div class="muted-cell" style="text-transform:uppercase;letter-spacing:.04em;font-size:11px;font-weight:700">
        ${escapeHtml(label)}
      </div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">${value}</div>
      ${note ? `<div class="muted-cell">${escapeHtml(note)}</div>` : ""}
    </div>`;
}

function renderHistory(settled, planName) {
  return `
    <div class="table-card">
      <div class="table-scroll">
        <table>
          <thead>
            <tr><th>Tier</th><th>Monthly</th><th>Sent</th><th>Answered</th><th>Outcome</th><th>Note</th></tr>
          </thead>
          <tbody>
            ${settled
              .map(
                (a) => `
              <tr>
                <td><strong>${escapeHtml(planName(a.proposal.recommended_plan_id))}</strong></td>
                <td>${formatCurrency(a.proposal.monthly_estimate)}</td>
                <td>${escapeHtml(a.proposal.sent_on ?? "—")}</td>
                <td>${escapeHtml(a.proposal.responded_on ?? "—")}</td>
                <td>
                  <span class="badge ${a.status === "accepted" ? "active" : "churned"}">
                    ${escapeHtml(a.status)}
                  </span>
                </td>
                <td class="muted-cell">${escapeHtml(a.proposal.response_note ?? "—")}</td>
              </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ─── Answering ─────────────────────────────────────────────────── */

const COPY = {
  accept: {
    title: "Accept this proposal",
    body: `<p>Your subscription starts today and billing begins from this month.</p>
           <p class="muted-cell">Your auditor is notified, and your team's dashboards
           are enabled immediately.</p>`,
    confirm: "Accept and start",
    needsNote: false,
    toast: "Accepted. Your subscription is live.",
  },
  "request-changes": {
    title: "Request changes",
    body: `<p>What would you like changed?</p>
           <p class="muted-cell">Your auditor sees this and sends a revised proposal.
           Nothing is charged in the meantime.</p>`,
    confirm: "Send to auditor",
    needsNote: true,
    toast: "Sent. Your auditor will revise the proposal.",
  },
  decline: {
    title: "Decline this proposal",
    body: `<p>Let your auditor know why.</p>
           <p class="muted-cell">Nothing is charged. You can be re-quoted later.</p>`,
    confirm: "Decline",
    needsNote: true,
    toast: "Declined.",
  },
};

function respond(auditId, action, app) {
  const copy = COPY[action];
  const me = currentUser();

  openModal({
    title: copy.title,
    confirmLabel: copy.confirm,
    danger: action === "decline",
    bodyHtml:
      copy.body +
      (copy.needsNote
        ? `<div class="form-field full" style="margin-top:12px">
             <label for="respNote">Your note</label>
             <textarea id="respNote" rows="3"
               placeholder="e.g. we are hiring four more technicians next term — will this tier still fit?"></textarea>
             <span class="field-error" data-error-for="note"></span>
           </div>`
        : ""),
    onConfirm: (modal) => {
      const note = copy.needsNote
        ? (modal.querySelector("#respNote")?.value || "").trim()
        : "";
      if (copy.needsNote && !note) {
        modal.querySelector('[data-error-for="note"]').textContent =
          "Tell your auditor what to change.";
        return false;
      }

      app.update(async (state) => {
        try {
          await window.api.patch(
            `/energy-audits/${auditId}/proposal/${action}`,
            action === "accept"
              ? { accepted_by: me?.user_id }
              : { response_note: note, responded_by: me?.user_id },
          );
          // Re-read rather than patch locally: accepting also creates a
          // subscription and flips the organisation to active, and the
          // dashboard should reflect all of that.
          state.audits = await window.api.get("/energy-audits").catch(() => state.audits);
          state.subscriptions = await window.api
            .get("/subscriptions")
            .catch(() => state.subscriptions);
        } catch (err) {
          console.error("Proposal response failed:", err);
          showToast(err.message || "Could not send your answer.", "error");
        }
      }, copy.toast);
      return true;
    },
  });
}

/** The client's first move, and the trigger for the whole engagement. */
function requestAudit(app) {
  openModal({
    title: "Request an energy audit",
    confirmLabel: "Request audit",
    bodyHtml: `
      <p>A certified auditor will be assigned and will contact you to arrange
         the site visit.</p>
      <p class="muted-cell">Nothing is charged for this. You only pay once you
         accept the proposal that follows.</p>
      <div class="form-field full" style="margin-top:12px">
        <label for="auditNote">Anything they should know? (optional)</label>
        <textarea id="auditNote" rows="3"
          placeholder="e.g. two blocks, no sub-metering, bills have doubled since 2024"></textarea>
      </div>`,
    onConfirm: (modal) => {
      const note = (modal.querySelector("#auditNote")?.value || "").trim();

      app.update(async (state) => {
        try {
          await window.api.post("/energy-audits/request", note ? { note } : {});
          state.audits = await window.api
            .get("/energy-audits")
            .catch(() => state.audits);
        } catch (err) {
          console.error("Audit request failed:", err);
          showToast(err.message || "Could not request an audit.", "error");
        }
      }, "Audit requested. Your auditor has been notified.");
      return true;
    },
  });
}

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem("currentUser") || "null");
  } catch (_) {
    return null;
  }
}
