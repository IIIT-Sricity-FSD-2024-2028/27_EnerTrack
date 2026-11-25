import * as crypto from "crypto";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService, FoodWasteLog, UserRole } from "../../core/database/database.service";
import { assertTenantOwns, currentOrgId, scopeToTenant } from "../../core/tenancy/tenant-context";
import { CreateFoodWasteLogDto } from "./dto/create-food-waste-log.dto";

const DAY_MS = 86_400_000;
/** Roles that may log for anyone; everyone else must be on General Maintenance. */
const OFFICE_ROLES: string[] = [
  UserRole.ORGANIZATION_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.SUSTAINABILITY_OFFICER,
  UserRole.OPERATIONS_COORDINATOR,
  UserRole.FACILITY_MANAGER,
];
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);
/** Places are matched loosely: "north campus cafeteria " is the same place. */
export const placeKey = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Average kg per logged day, or null with no logs. */
export function kgPerDay(logs: FoodWasteLog[]): number | null {
  if (logs.length === 0) return null;
  const byDay = new Map<string, number>();
  for (const l of logs) byDay.set(l.date, (byDay.get(l.date) ?? 0) + l.kg);
  const total = [...byDay.values()].reduce((a, b) => a + b, 0);
  return Number((total / byDay.size).toFixed(1));
}

/**
 * Food-waste weigh-ins. General Maintenance logs what they clear from the
 * food-waste bins; the Sustainability Officer reads the trend, and a food
 * wastage target is checked against it the way an energy target is checked
 * against a meter.
 */
@Injectable()
export class FoodWasteLogsService {
  constructor(private database: DatabaseService) {}

  create(dto: CreateFoodWasteLogDto, userId?: string, role?: string) {
    const user = this.database.users.find((u) => u.user_id === userId);
    // Of the field staff (Technician, and roles that pass as one), only
    // General Maintenance clears the food bins.
    if (!OFFICE_ROLES.includes(role ?? "") && user?.team !== "general")
      throw new ForbiddenException("Only General Maintenance logs food waste.");
    const date = dto.date ?? today();
    if (date > today()) throw new BadRequestException("The date cannot be in the future.");
    if (dto.building_id && !scopeToTenant(this.database.buildings).some((b) => b.building_id === dto.building_id))
      throw new NotFoundException(`Building '${dto.building_id}' not found.`);

    const log: FoodWasteLog = {
      log_id: crypto.randomUUID(),
      organization_id: currentOrgId() ?? user?.organization_id ?? "",
      location: dto.location.trim().replace(/\s+/g, " "),
      building_id: dto.building_id ?? null,
      date,
      kg: Number(dto.kg.toFixed(1)),
      meal: dto.meal ?? null,
      logged_by: userId ?? "unknown",
      created_at: new Date().toISOString(),
    };
    this.database.foodWasteLogs.push(log);
    return log;
  }

  /** Newest first; optionally for one place and a date range. */
  findAll(location?: string, from?: string, to?: string) {
    return scopeToTenant(this.database.foodWasteLogs)
      .filter((l) => !location || placeKey(l.location) === placeKey(location))
      .filter((l) => (!from || l.date >= from) && (!to || l.date <= to))
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }

  /**
   * One line per place: kg a day over the last 7 and the last 30 days, and
   * whether the last week is up on the month (a waste signal).
   */
  summary() {
    const groups = new Map<string, FoodWasteLog[]>();
    for (const l of scopeToTenant(this.database.foodWasteLogs)) {
      const k = placeKey(l.location);
      groups.set(k, [...(groups.get(k) ?? []), l]);
    }
    const week = daysAgo(7);
    const month = daysAgo(30);
    return [...groups.values()].map((logs) => {
      const last7 = kgPerDay(logs.filter((l) => l.date > week));
      const last30 = kgPerDay(logs.filter((l) => l.date > month));
      return {
        location: logs[0].location,
        kg_per_day_7d: last7,
        kg_per_day_30d: last30,
        last_logged: logs.map((l) => l.date).sort().pop() ?? null,
        rising: last7 !== null && last30 !== null && last7 > last30 * 1.1,
      };
    });
  }

  remove(id: string) {
    const index = this.database.foodWasteLogs.findIndex((l) => l.log_id === id);
    if (index === -1 || !assertTenantOwns(this.database.foodWasteLogs[index]))
      throw new NotFoundException(`Food waste log ${id} not found`);
    return this.database.foodWasteLogs.splice(index, 1)[0];
  }
}
