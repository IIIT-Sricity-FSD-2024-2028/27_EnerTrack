/**
 * budgetRules.js — how much budget a campus or building still has to give.
 *
 * Mirrors backend/src/core/utils/budget-rules.ts: the budgets of a parent's
 * children may add up to at most the parent's own. The backend is the real
 * check; these numbers are only so the popups can say the limit up front.
 */

function sumBudgets(list) {
  return list.reduce((sum, item) => sum + (Number(item.budget) || 0), 0);
}

/** Most a building can have in this campus, leaving out the one being edited. */
export function maxBuildingBudget(campus, buildings, excludeId) {
  if (!campus) return null;
  const others = buildings.filter(
    (b) => b.campus_id === campus.campus_id && b.building_id !== excludeId,
  );
  return Math.max(campus.total_budget - sumBudgets(others), 0);
}

/** Most a department can have in this building, or null when it sets no limit. */
export function maxDepartmentBudget(building, departments, excludeId) {
  if (!building || building.budget == null) return null;
  const others = departments.filter(
    (d) =>
      d.building_id === building.building_id && d.department_id !== excludeId,
  );
  return Math.max(building.budget - sumBudgets(others), 0);
}

/** Least a campus budget can be: what its buildings already hold. */
export function minCampusBudget(campusId, buildings) {
  return sumBudgets(buildings.filter((b) => b.campus_id === campusId));
}

/** Least a building budget can be: what its departments already hold. */
export function minBuildingBudget(buildingId, departments) {
  return sumBudgets(departments.filter((d) => d.building_id === buildingId));
}
