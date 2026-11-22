/**
 * organizationsSlice.js: /organizations (id: organization_id). Owner: Person 1.
 *
 * CRUD comes from createCrudSlice; see its header. Extra:
 *   fetchOrganizationSavings({ orgId, from, to })
 *     GET /organizations/:id/savings?from=&to=, stored under
 *     state.organizations.savingsByOrg[orgId] and read with
 *     selectOrganizationSavings(state, orgId). It is null when there is no
 *     data yet or the request failed.
 */
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";

export const fetchOrganizationSavings = apiThunk(
  "organizations/fetchSavings",
  async ({ orgId, from, to }) => {
    const query = new URLSearchParams({ from, to }).toString();
    const savings = await api.get(`/organizations/${orgId}/savings?${query}`);
    return { orgId, savings };
  },
);

const organizations = createCrudSlice({
  name: "organizations",
  path: "/organizations",
  idKey: "organization_id",
  initialState: { savingsByOrg: {} },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrganizationSavings.fulfilled, (state, { payload }) => {
        state.savingsByOrg[payload.orgId] = payload.savings ?? null;
      })
      .addCase(fetchOrganizationSavings.rejected, (state, { meta }) => {
        state.savingsByOrg[meta.arg.orgId] = null;
      });
  },
});

export const {
  fetchAll: fetchOrganizations,
  fetchOne: fetchOrganization,
  create: createOrganization,
  update: updateOrganization,
  remove: removeOrganization,
} = organizations.thunks;

export const {
  selectAll: selectAllOrganizations,
  selectById: selectOrganizationById,
  selectStatus: selectOrganizationsStatus,
  selectError: selectOrganizationsError,
} = organizations.selectors;

export const selectOrganizationSavings = (state, orgId) =>
  state.organizations.savingsByOrg[orgId] ?? null;

export default organizations.reducer;
