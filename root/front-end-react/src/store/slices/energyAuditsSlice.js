/**
 * energyAuditsSlice.js: /energy-audits (id: audit_id). Owner: Person 2.
 * Each audit row carries its `findings` and `proposal`.
 *
 * CRUD comes from createCrudSlice; see its header. Notes and status changes
 * are plain updateEnergyAudit({ id, changes }). Extra endpoints, and what
 * each one answers (checked against the backend services):
 *
 *   requestEnergyAudit(note)          POST  /energy-audits/request
 *     → the new audit: upserted. (Named so, not requestAudit, because
 *       authSlice.requestAudit is the public organisation sign-up.)
 *   addFinding({ auditId, body })     POST  /:id/findings
 *   updateFinding({ auditId, findingId, changes })
 *                                     PATCH /:id/findings/:findingId
 *     → only the finding, so the whole audit is re-read (fetchEnergyAudit).
 *   submitProposal({ auditId, body }) POST  /:id/proposal
 *     → the audit: upserted.
 *   answerProposal({ auditId, action, note })
 *                                     PATCH /:id/proposal/{accept|request-changes|decline}
 *     → request-changes / decline: the audit. accept: { audit, subscription }.
 *       The audit is upserted. Accepting also creates the subscription and
 *       activates the organisation, so those lists are reloaded.
 *
 *   loadAuditPortfolio()  the auditor Overview's load: re-reads the audits,
 *     then each measurable client's savings (fetchOrganizationSavings in
 *     organizationsSlice) over its own window. Read the result with
 *     selectImpactWithSavings.
 */
import { createSelector } from "@reduxjs/toolkit";
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";
import { impactClients } from "../../pages/auditor/overview/impact";
import {
  fetchOrganizationSavings,
  fetchOrganizations,
} from "./organizationsSlice";
import { fetchSubscriptions } from "./subscriptionsSlice";

const PATH = "/energy-audits";

export const requestEnergyAudit = apiThunk("energyAudits/request", (note) =>
  api.post(`${PATH}/request`, note ? { note } : {}),
);

export const submitProposal = apiThunk(
  "energyAudits/submitProposal",
  ({ auditId, body }) => api.post(`${PATH}/${auditId}/proposal`, body),
);

export const answerProposal = apiThunk(
  "energyAudits/answerProposal",
  async ({ auditId, action, note }, { dispatch }) => {
    // Who answered comes from the signed-in session on the server.
    const result = await api.patch(
      `${PATH}/${auditId}/proposal/${action}`,
      action === "accept" ? {} : { response_note: note },
    );
    if (action === "accept") {
      dispatch(fetchSubscriptions({ force: true }));
      dispatch(fetchOrganizations({ force: true }));
    }
    return result?.audit ?? result;
  },
);

const audits = createCrudSlice({
  name: "energyAudits",
  path: PATH,
  idKey: "audit_id",
  extraReducers: (builder, { adapter, isRow }) => {
    const upsert = (state, { payload }) => {
      if (isRow(payload)) adapter.upsertOne(state, payload);
    };
    builder
      .addCase(requestEnergyAudit.fulfilled, upsert)
      .addCase(submitProposal.fulfilled, upsert)
      .addCase(answerProposal.fulfilled, upsert);
  },
});

export const {
  fetchAll: fetchEnergyAudits,
  fetchOne: fetchEnergyAudit,
  create: createEnergyAudit,
  update: updateEnergyAudit,
  remove: removeEnergyAudit,
} = audits.thunks;

// Declared after the slice: they re-read the audit with its fetchOne.
export const addFinding = apiThunk(
  "energyAudits/addFinding",
  async ({ auditId, body }, { dispatch }) => {
    const finding = await api.post(`${PATH}/${auditId}/findings`, body);
    await dispatch(fetchEnergyAudit(auditId));
    return finding;
  },
);

export const updateFinding = apiThunk(
  "energyAudits/updateFinding",
  async ({ auditId, findingId, changes }, { dispatch }) => {
    const finding = await api.patch(
      `${PATH}/${auditId}/findings/${findingId}`,
      changes,
    );
    await dispatch(fetchEnergyAudit(auditId));
    return finding;
  },
);

export const {
  selectAll: selectAllEnergyAudits,
  selectById: selectEnergyAuditById,
  selectStatus: selectEnergyAuditsStatus,
  selectError: selectEnergyAuditsError,
} = audits.selectors;

const isClosed = (a) => a.status === "accepted" || a.status === "declined";

/** Engagements the client has not said yes or no to yet. */
export const selectOpenAudits = createSelector(
  [selectAllEnergyAudits],
  (rows) => rows.filter((a) => !isClosed(a)),
);

/** The auditor's KPI counts: { total, open, findings, implemented }. */
export const selectAuditCounts = createSelector(
  [selectAllEnergyAudits],
  (rows) => {
    let findings = 0;
    let implemented = 0;
    for (const audit of rows) {
      for (const finding of audit.findings || []) {
        findings++;
        if (finding.status === "implemented") implemented++;
      }
    }
    return {
      total: rows.length,
      open: rows.filter((a) => !isClosed(a)).length,
      findings,
      implemented,
    };
  },
);

/** Proposals waiting for the client's answer. */
export const selectOpenProposals = createSelector(
  [selectAllEnergyAudits],
  (rows) =>
    rows.filter(
      (a) =>
        a.proposal &&
        (a.status === "proposed" || a.status === "changes-requested"),
    ),
);

/** Proposals the client has accepted or declined. */
export const selectAnsweredProposals = createSelector(
  [selectAllEnergyAudits],
  (rows) => rows.filter((a) => a.proposal && isClosed(a)),
);

/**
 * Recommendations no client has carried out yet (proposed or accepted),
 * across every audit: [{ finding, orgId }].
 */
export const selectOutstandingFindings = createSelector(
  [selectAllEnergyAudits],
  (rows) => {
    const out = [];
    for (const audit of rows) {
      for (const finding of audit.findings || []) {
        if (finding.status === "proposed" || finding.status === "accepted") {
          out.push({ finding, orgId: audit.organization_id });
        }
      }
    }
    return out;
  },
);

/**
 * One entry per client with an accepted audit, and the window its savings
 * are measured over (see pages/auditor/overview/impact.js).
 */
export const selectImpactClients = createSelector(
  [selectAllEnergyAudits],
  (rows) => impactClients(rows),
);

/**
 * selectImpactClients joined with each client's savings from
 * organizationsSlice (fetchOrganizationSavings). `savings` is undefined
 * while that client's request has not answered yet, null when it failed.
 */
export const selectImpactWithSavings = createSelector(
  [selectImpactClients, (state) => state.organizations.savingsByOrg],
  (clients, savingsByOrg) =>
    clients.map((client) => ({
      ...client,
      savings: client.window ? savingsByOrg[client.organization_id] : null,
    })),
);

export const loadAuditPortfolio = apiThunk(
  "energyAudits/loadPortfolio",
  async (_, { dispatch, getState }) => {
    // A failed reload is recorded by the audits slice. Carry on with the
    // audits already held (none on a failed first load), so the page never
    // waits on savings that were never asked for.
    await dispatch(fetchEnergyAudits({ force: true }));
    const measurable = selectImpactClients(getState()).filter((c) => c.window);
    await Promise.all(
      measurable.map((c) =>
        dispatch(
          fetchOrganizationSavings({ orgId: c.organization_id, ...c.window }),
        ),
      ),
    );
  },
);

export default audits.reducer;
