/**
 * serviceRequestsSlice.js: /service-requests (id: service_request_id),
 * plus the issue catalogue the report form and the coordinator board use.
 *
 * Owner: Person 5.
 *
 * CRUD from createCrudSlice (see its header):
 *   fetchServiceRequests(arg?)     GET    /service-requests
 *   fetchServiceRequest(id)        GET    /service-requests/:id
 *   createServiceRequest(body)     POST   /service-requests
 *   updateServiceRequest({ id, changes }) PATCH /service-requests/:id
 *   removeServiceRequest(id)       DELETE /service-requests/:id
 *
 * Staff / shared thunks:
 *   setServiceRequestPriority({ id, level })
 *                                  PUT /service-requests/:id/priority (returns full row)
 *   fetchServiceCatalogue()        GET /service-requests/catalogue → state.serviceCatalogue.data
 *
 * Campus occupant thunks (all return StudentTicketView or SubmitOutcome; no fallback
 * GET /service-requests/:id is needed because StudentTicketView carries all UI fields
 * and GET /:id is staff-only):
 *   fetchMyServiceRequests()       GET  /service-requests/mine → upserts entities + mineIds
 *   fetchCampusIssues(filters?)    GET  /service-requests/campus-issues → upserts entities + campusIssueIds
 *   submitServiceReport(payload)   POST /service-requests/reports → upserts ticket if created/joined; returns full outcome
 *   plusOneServiceRequest(id)      POST /service-requests/:id/plus-one → upserts updated ticket + adds to mineIds
 *   confirmFixed(id)               POST /service-requests/:id/confirm-fixed → upserts updated ticket
 *   stillBroken({ id, reason, photo })
 *                                  POST /service-requests/:id/still-broken → upserts new ticket + marks old can_respond: false
 *
 * Selectors:
 *   selectAllServiceRequests, selectServiceRequestById,
 *   selectServiceRequestsStatus, selectServiceRequestsError
 *   selectServiceCatalogue
 *   selectMyServiceRequests        resolves mineIds against entities
 *   selectCampusIssues             resolves campusIssueIds against entities
 */
import { createSelector } from "@reduxjs/toolkit";
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";
import { createResourceSlice } from "../createResourceSlice";

/**
 * StudentTicketView uses `id` while staff ServiceRequest uses `service_request_id`.
 * Ensure every entity stored in the adapter has `service_request_id`.
 */
function toEntity(row) {
  if (!row || typeof row !== "object") return null;
  const id = row.service_request_id ?? row.id;
  if (!id) return null;
  return row.service_request_id ? row : { ...row, service_request_id: id };
}

export const setServiceRequestPriority = apiThunk(
  "serviceRequests/setPriority",
  ({ id, level }) => api.put(`/service-requests/${id}/priority`, { level }),
);

export const fetchMyServiceRequests = apiThunk(
  "serviceRequests/fetchMine",
  async () => {
    const list = await api.get("/service-requests/mine");
    return Array.isArray(list) ? list : [];
  },
);

export const fetchCampusIssues = apiThunk(
  "serviceRequests/fetchCampusIssues",
  async (filters) => {
    const q = new URLSearchParams();
    if (filters?.buildingId) q.set("building_id", filters.buildingId);
    if (filters?.buildingId && filters?.floor) q.set("floor", filters.floor);
    const list = await api.get(
      `/service-requests/campus-issues${q.size ? `?${q}` : ""}`,
    );
    return Array.isArray(list) ? list : [];
  },
);

export const submitServiceReport = apiThunk(
  "serviceRequests/submitReport",
  (payload) => api.post("/service-requests/reports", payload),
);

export const plusOneServiceRequest = apiThunk(
  "serviceRequests/plusOne",
  (id) => api.post(`/service-requests/${id}/plus-one`, {}),
);

export const confirmFixed = apiThunk(
  "serviceRequests/confirmFixed",
  (id) => api.post(`/service-requests/${id}/confirm-fixed`, {}),
);

export const stillBroken = apiThunk(
  "serviceRequests/stillBroken",
  ({ id, reason, photo }) =>
    photo
      ? api.upload(`/service-requests/${id}/still-broken`, "photo", photo, {
          reason,
        })
      : api.post(`/service-requests/${id}/still-broken`, { reason }),
);

const serviceRequests = createCrudSlice({
  name: "serviceRequests",
  path: "/service-requests",
  idKey: "service_request_id",
  initialState: {
    mineIds: [],
    campusIssueIds: [],
  },
  extraReducers: (builder, { adapter, isRow }) => {
    builder
      .addCase(setServiceRequestPriority.fulfilled, (state, { payload }) => {
        if (isRow(payload)) adapter.upsertOne(state, payload);
      })
      .addCase(fetchMyServiceRequests.fulfilled, (state, { payload }) => {
        const entities = payload.map(toEntity).filter(Boolean);
        adapter.upsertMany(state, entities);
        state.mineIds = entities.map((e) => e.service_request_id);
      })
      .addCase(fetchCampusIssues.fulfilled, (state, { payload }) => {
        const entities = payload.map(toEntity).filter(Boolean);
        adapter.upsertMany(state, entities);
        state.campusIssueIds = entities.map((e) => e.service_request_id);
      })
      .addCase(submitServiceReport.fulfilled, (state, { payload }) => {
        const entity = toEntity(payload?.ticket);
        if (entity) {
          adapter.upsertOne(state, entity);
          if (!state.mineIds.includes(entity.service_request_id)) {
            state.mineIds.push(entity.service_request_id);
          }
        }
      })
      .addCase(plusOneServiceRequest.fulfilled, (state, { payload }) => {
        const entity = toEntity(payload);
        if (entity) {
          adapter.upsertOne(state, entity);
          if (!state.mineIds.includes(entity.service_request_id)) {
            state.mineIds.push(entity.service_request_id);
          }
        }
      })
      .addCase(confirmFixed.fulfilled, (state, { payload }) => {
        const entity = toEntity(payload);
        if (entity) adapter.upsertOne(state, entity);
      })
      .addCase(stillBroken.fulfilled, (state, { payload, meta }) => {
        const entity = toEntity(payload?.ticket ?? payload);
        if (entity) {
          adapter.upsertOne(state, entity);
          if (!state.mineIds.includes(entity.service_request_id)) {
            state.mineIds.push(entity.service_request_id);
          }
        }
        const sourceId = meta?.arg?.id;
        if (sourceId && state.entities[sourceId]) {
          adapter.updateOne(state, {
            id: sourceId,
            changes: { can_respond: false },
          });
        }
      });
  },
});

export const {
  fetchAll: fetchServiceRequests,
  fetchOne: fetchServiceRequest,
  create: createServiceRequest,
  update: updateServiceRequest,
  remove: removeServiceRequest,
} = serviceRequests.thunks;

export const {
  selectAll: selectAllServiceRequests,
  selectById: selectServiceRequestById,
  selectStatus: selectServiceRequestsStatus,
  selectError: selectServiceRequestsError,
} = serviceRequests.selectors;

const selectEntities = (state) => state.serviceRequests.entities;
const selectMineIds = (state) => state.serviceRequests.mineIds;
const selectCampusIssueIds = (state) => state.serviceRequests.campusIssueIds;

export const selectMyServiceRequests = createSelector(
  [selectEntities, selectMineIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export const selectCampusIssues = createSelector(
  [selectEntities, selectCampusIssueIds],
  (entities, ids) => ids.map((id) => entities[id]).filter(Boolean),
);

export default serviceRequests.reducer;

/* ── the issue catalogue (one object, not a list) ─────────────── */

const serviceCatalogue = createResourceSlice({
  name: "serviceCatalogue",
  path: "/service-requests/catalogue",
});

export const { fetch: fetchServiceCatalogue } = serviceCatalogue.thunks;
export const { selectData: selectServiceCatalogue } =
  serviceCatalogue.selectors;
export const serviceCatalogueReducer = serviceCatalogue.reducer;
