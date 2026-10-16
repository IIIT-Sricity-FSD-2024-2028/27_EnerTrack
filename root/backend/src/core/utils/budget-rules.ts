import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

/**
 * Budget nesting rules for Campus → Building → Department.
 *
 * definitions.yml defines a budget as the allocation for "a department,
 * building, or the entire campus": nested scopes of the same money. So the
 * budgets of a parent's children may add up to at most the parent's own.
 *
 * Checked in both directions:
 *   - adding, editing or moving a child must fit what the parent has left
 *   - lowering a parent must not drop it below what is already allocated
 *
 * A child with no budget counts as 0. A building with no budget sets no
 * limit for its departments, because nothing has been allocated to split.
 */

/** ₹9,00,000 — the same Indian grouping the dashboards display. */
function rupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** A building's budget must fit within what its campus has not yet allocated. */
export function assertBuildingFitsCampus(
  db: DatabaseService,
  campusId: string,
  budget: number | null | undefined,
  excludeBuildingId?: string,
) {
  const campus = db.campus.find((c) => c.campus_id === campusId);
  if (!campus)
    throw new NotFoundException(`Target campus with id '${campusId}' not found`);

  const allocated = db.buildings
    .filter(
      (b) => b.campus_id === campusId && b.building_id !== excludeBuildingId,
    )
    .reduce((sum, b) => sum + (b.budget ?? 0), 0);
  const available = campus.total_budget - allocated;

  if ((budget ?? 0) > available)
    throw new BadRequestException(
      `${campus.name} has a budget of ${rupees(campus.total_budget)} and ` +
        `${rupees(allocated)} is already allocated to its other buildings, ` +
        `so this building can have at most ${rupees(Math.max(available, 0))}.`,
    );
}

/** A department's budget must fit within what its building has not yet allocated. */
export function assertDepartmentFitsBuilding(
  db: DatabaseService,
  buildingId: string,
  budget: number | null | undefined,
  excludeDepartmentId?: string,
) {
  const building = db.buildings.find((b) => b.building_id === buildingId);
  if (!building)
    throw new NotFoundException(
      `Target buildings with id '${buildingId}' not found`,
    );
  if (building.budget == null) return;

  const allocated = db.departments
    .filter(
      (d) =>
        d.building_id === buildingId && d.department_id !== excludeDepartmentId,
    )
    .reduce((sum, d) => sum + (d.budget ?? 0), 0);
  const available = building.budget - allocated;

  if ((budget ?? 0) > available)
    throw new BadRequestException(
      `${building.name} has a budget of ${rupees(building.budget)} and ` +
        `${rupees(allocated)} is already allocated to its other departments, ` +
        `so this department can have at most ${rupees(Math.max(available, 0))}.`,
    );
}

/** A campus budget cannot drop below what its buildings already hold. */
export function assertCampusCoversBuildings(
  db: DatabaseService,
  campusId: string,
  totalBudget: number,
) {
  const allocated = db.buildings
    .filter((b) => b.campus_id === campusId)
    .reduce((sum, b) => sum + (b.budget ?? 0), 0);

  if (totalBudget < allocated)
    throw new BadRequestException(
      `This campus's buildings already hold ${rupees(allocated)}, ` +
        `so its budget cannot be less than that.`,
    );
}

/** A building budget cannot drop below what its departments already hold. */
export function assertBuildingCoversDepartments(
  db: DatabaseService,
  buildingId: string,
  budget: number | null | undefined,
) {
  if (budget == null) return;

  const allocated = db.departments
    .filter((d) => d.building_id === buildingId)
    .reduce((sum, d) => sum + (d.budget ?? 0), 0);

  if (budget < allocated)
    throw new BadRequestException(
      `This building's departments already hold ${rupees(allocated)}, ` +
        `so its budget cannot be less than that.`,
    );
}
