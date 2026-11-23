/**
 * serviceRequestsSlice.js: /service-requests (id: service_request_id),
 * plus the issue catalogue the report form and the coordinator board use.
 *
 * Owner: Person 5. Person 1 created the base because the technician pages
 * needed it first; Person 5 adds the campus-occupant thunks (mine,
 * campus-issues, reports, plus-one, confirm-fixed, still-broken).
 *
 *   CRUD                           createCrudSlice (see its header)
 *   setServiceRequestPriority({ id, level })
 *                                  PUT /service-requests/:id/priority;
 *                                  level null = back to the system's level
 *   fetchServiceCatalogue()        GET /service-requests/catalogue →
 *                                  state.serviceCatalogue.data
 */
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";
import { createResourceSlice } from "../createResourceSlice";

export const setServiceRequestPriority = apiThunk(
  "serviceRequests/setPriority",
  ({ id, level }) => api.put(`/service-requests/${id}/priority`, { level }),
);

const serviceRequests = createCrudSlice({
  name: "serviceRequests",
  path: "/service-requests",
  idKey: "service_request_id",
  extraReducers: (builder, { adapter, isRow }) => {
    builder.addCase(
      setServiceRequestPriority.fulfilled,
      (state, { payload }) => {
        if (isRow(payload)) adapter.upsertOne(state, payload);
      },
    );
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
