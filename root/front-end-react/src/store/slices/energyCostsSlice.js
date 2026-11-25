/**
 * energyCostsSlice.js: /energy-costs (id: energy_cost_id). Owner: Person 3.
 *
 * CRUD from createCrudSlice (see its header). The store keeps the raw rows;
 * the pages read them through the selectors below, which reshape each row
 * with normalizeCost (camelCase, totals, variance, budget status).
 *
 * Selectors:
 *   selectEnergyCostRows     every record, normalized, with department and
 *                            building names filled in
 *   selectLatestCostPeriod   newest period on file ("2025-03")
 *   selectLatestCostRows     the records of that period (Overview cards and bars)
 *   selectFinancePlaces      { departments, buildings } as [{ id, name }]
 *                            for the scope dropdowns
 */
import { createSelector } from "@reduxjs/toolkit";
import { createCrudSlice } from "../createCrudSlice";
import { normalizeCost } from "../../pages/finance/financeApi";
import { latestPeriod } from "../../pages/finance/financeUtils";
import { selectAllBuildings } from "./buildingsSlice";
import { selectAllDepartments } from "./departmentsSlice";

const energyCosts = createCrudSlice({
  name: "energyCosts",
  path: "/energy-costs",
  idKey: "energy_cost_id",
});

export const {
  fetchAll: fetchEnergyCosts,
  fetchOne: fetchEnergyCost,
  create: createEnergyCost,
  update: updateEnergyCost,
  remove: removeEnergyCost,
} = energyCosts.thunks;

export const {
  selectAll: selectAllEnergyCosts,
  selectById: selectEnergyCostById,
  selectStatus: selectEnergyCostsStatus,
  selectError: selectEnergyCostsError,
} = energyCosts.selectors;

export const selectFinancePlaces = createSelector(
  [selectAllDepartments, selectAllBuildings],
  (departments, buildings) => ({
    departments: departments.map((d) => ({ id: d.department_id, name: d.name })),
    buildings: buildings.map((b) => ({ id: b.building_id, name: b.name })),
  }),
);

/** id → name, so a record saved without a scope label still shows a name. */
function namesFrom({ departments, buildings }) {
  const names = {};
  for (const place of [...departments, ...buildings]) names[place.id] = place.name;
  return names;
}

export const selectEnergyCostRows = createSelector(
  [selectAllEnergyCosts, selectFinancePlaces],
  (costs, places) => {
    const names = namesFrom(places);
    return costs.map((row) => normalizeCost(row, names));
  },
);

export const selectLatestCostPeriod = createSelector([selectEnergyCostRows], (rows) =>
  latestPeriod(rows),
);

export const selectLatestCostRows = createSelector(
  [selectEnergyCostRows, selectLatestCostPeriod],
  (rows, period) => rows.filter((row) => row.period === period),
);

export default energyCosts.reducer;
