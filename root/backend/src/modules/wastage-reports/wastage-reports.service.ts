import * as crypto from "crypto";
import * as fs from "fs";
import * as nodePath from "path";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import {
  DatabaseService,
  FoodWasteLog,
  NotificationTargetType,
  ROLE_EQUIVALENTS,
  UserRole,
  WastageReport,
} from "../../core/database/database.service";
import { assertMove, MoveTable } from "../../core/utils/transitions";
import { pushNotifications, usersWithRole } from "../../core/utils/notify";
import { addMonths, lastFullMonth, periodsBetween } from "../../core/utils/period";
import { compareYoY, meterSum } from "../../core/utils/period-compare";
import { DispatchService } from "../dispatch/dispatch.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { CreateWastageReportDto } from "./dto/create-wastage-report.dto";
import {
  AREAS,
  AreaId,
  FLOORS,
  PARTS,
  WasteKind,
  findItem,
  findProblem,
  alertsOfficer,
  wasteKindOf,
} from "../issue-catalogue/issue-catalogue";
import { cleanPart } from "../issue-catalogue/dedupe";
import { kgPerDay, placeKey } from "../food-waste-logs/food-waste-logs.service";
import { PutWastageReportDto } from "./dto/put-wastage-report.dto";

import { UpdateWastageReportDto } from "./dto/update-wastage-report.dto";
import { AddWastageCommentDto } from "./dto/add-wastage-comment.dto";

/**
 * A wastage case: a *pattern* of waste the Sustainability Officer has chosen
 * to tackle (a hotspot of repeated waste issues, or something seen on the
 * meters). Single incidents — lights left on, a tap running — are ordinary
 * issue reports and never come here; a case links to the incidents behind it
 * through source_request_ids.
 *
 * Finance is involved only when the remedy needs spending (details.remedy):
 *
 *   Open ──► remedy "no_cost" ─────────────────────────────────► Target Set
 *     │  └─► remedy "spend" ──► Forwarded to Finance ──► Cost Impact Added
 *     │                               ▲                         │
 *     ▼                               └──── Returned to SO ◄────┘
 *   Dismissed                                    │
 *                                                ▼
 *   Target Set ──(deadline / checked early)──► Verify Target ──► Target Met ──► Closed
 *        ▲                                                  └─► Target Missed ─► Closed
 *        └──────────────────── (try again) ─────────────────────────┘
 *
 * Older records may still say "pending", "Reported" or "Validated" (read as
 * Open) or "Finalized" / "Delivered" (read as Closed).
 */
const OFFICER_MOVES: Record<string, string[]> = {
  Open: ["Target Set", "Forwarded to Finance", "Dismissed"],
  "Returned to SO": ["Target Set", "Forwarded to Finance", "Dismissed"],
  "Target Set": ["Verify Target"],
  "Verify Target": ["Target Met", "Target Missed"],
  "Target Met": ["Closed"],
  "Target Missed": ["Closed", "Target Set"],
};

const FINANCE_MOVES: Record<string, string[]> = {
  "Forwarded to Finance": ["Cost Impact Added"],
  "Cost Impact Added": ["Returned to SO"],
};

const WORKFLOW: MoveTable[] = [
  { roles: [UserRole.SUSTAINABILITY_OFFICER, UserRole.ORGANIZATION_ADMIN], moves: OFFICER_MOVES },
  { roles: [UserRole.FINANCIAL_ANALYST, UserRole.ORGANIZATION_ADMIN], moves: FINANCE_MOVES },
];

/** Every status the workflow knows about. */
const KNOWN_STATUSES = new Set([
  ...Object.keys(OFFICER_MOVES),
  ...Object.keys(FINANCE_MOVES),
  ...Object.values(OFFICER_MOVES).flat(),
  ...Object.values(FINANCE_MOVES).flat(),
]);

/**
 * The workflow check for a status change. A case sitting in a status the
 * workflow does not know is not blocked.
 */
function assertWastageMove(role: string | undefined, from: string, to: string) {
  if (!KNOWN_STATUSES.has(from)) return;
  assertMove(WORKFLOW, role, from, to, "a wastage case");
}

export type RemedyType = "no_cost" | "spend";

/**
 * Whether Finance is involved is a rule, not a choice: a remedy that needs
 * spending must be costed by Finance before a target is set, and a no-cost
 * remedy (schedule, policy, awareness) never goes to Finance.
 */
function assertRemedyRule(from: string, to: string, details: Record<string, any> | undefined) {
  if (from === to) return;
  const needsRemedy = to === "Forwarded to Finance" || (from === "Open" && to === "Target Set");
  if (!needsRemedy) return;
  const remedy = details?.remedy;
  if (!remedy || (remedy.type !== "no_cost" && remedy.type !== "spend"))
    throw new BadRequestException(
      "Choose a remedy first: details.remedy.type must be 'no_cost' or 'spend'.",
    );
  if (to === "Forwarded to Finance") {
    if (remedy.type !== "spend")
      throw new ForbiddenException("Only a remedy that needs spending goes to Finance; set the target directly.");
    if (!(Number(remedy.estimate) > 0))
      throw new BadRequestException("A remedy that needs spending must give its estimated cost (details.remedy.estimate > 0).");
  }
  if (to === "Target Set" && remedy.type === "spend")
    throw new ForbiddenException("A remedy that needs spending must be costed by Finance before a target is set.");
}

/** Older spellings, read as the status they became. */
const LEGACY_STATUS: Record<string, string> = {
  pending: "Open",
  reported: "Open",
  validated: "Open",
  open: "Open",
  finalized: "Closed",
  delivered: "Closed",
};

function canonicalStatus(status: string | undefined | null): string {
  if (!status) return "Open";
  return LEGACY_STATUS[status.trim().toLowerCase()] ?? status;
}

/** How far back the waste signals look. */
const SIGNAL_WINDOW_DAYS = 30;
/** Repeated incidents at one place within the window that make a hotspot. */
const HOTSPOT_INCIDENTS = 3;
/** A meter this much above the same month last year is a signal. */
const METER_RISE_PCT = 10;

export interface WasteSignal {
  key: string;
  kind: WasteKind;
  source: "reports" | "food_log" | "meter";
  location: string;
  building_id: string | null;
  incidents: number;
  people: number;
  last_at: string | null;
  ticket_ids: string[];
  sensor_reading_id: string | null;
  reasons: string[];
  /** Meets the hotspot rule (otherwise only shown under "all groups"). */
  hotspot: boolean;
  watched: boolean;
  /** An active case already covers it. */
  case_id: string | null;
}

/** The fields of a ticket the signals read. */
interface ServiceRequestLike {
  service_request_id: string;
  reporter_id: string;
  reporter_ids?: string[];
  plus_one_ids?: string[];
  created_at?: string;
  building_id?: string;
  floor?: string;
  area?: string;
  part?: string;
  issue_type_id?: string;
  item_id?: string;
  problem_id?: string | null;
  source_wastage?: string;
}

/** Statuses in which a case is still being worked on. */
const ACTIVE_CASE = ["Open", "Forwarded to Finance", "Cost Impact Added", "Returned to SO", "Target Set", "Verify Target", "Target Missed"];

/** The short reference the pages show, e.g. WR-3N2A8Z (same hash as reportRef in the front end). */
export function reportRef(id: string): string {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `WR-${h.toString(36).toUpperCase().padStart(6, "0").slice(-6)}`;
}

@Injectable()
export class WastageReportsService {
  constructor(
    private database: DatabaseService,
    private dispatch: DispatchService,
  ) {}

  /** Where a case is, in words: its location, else its title. */
  private static whereOf(report: WastageReport): string {
    const d = report.details ?? {};
    return String(d.location ?? d.specificData?.location ?? d.title ?? "").trim();
  }

  /**
   * Everyone who reported one of the incidents behind a case (their tickets'
   * reporters), so the people who raised the problem hear what came of it.
   */
  private linkedReporters(report: WastageReport): string[] {
    const ids = new Set<string>();
    for (const ticketId of report.source_request_ids ?? []) {
      // Only the case's own organisation: a stray id must never pull in
      // (and notify) people from another tenant.
      const t = this.database.serviceRequests.find(
        (x) => x.service_request_id === ticketId && x.organization_id === report.organization_id,
      );
      if (!t) continue;
      for (const r of [t.reporter_id, ...(t.reporter_ids ?? [])]) if (r && r !== "system") ids.add(r);
    }
    return [...ids];
  }

  /** Who hears about a move, and what they are told. */
  private notifyStatus(report: WastageReport, to: string, from?: string) {
    const ref = reportRef(report.wastage_report_id);
    const org = report.organization_id;
    const officers = () => usersWithRole(this.database, org, [UserRole.SUSTAINABILITY_OFFICER]);
    const finance = () => usersWithRole(this.database, org, [UserRole.FINANCIAL_ANALYST]);
    const where = WastageReportsService.whereOf(report);
    const remedy = String(report.details?.remedy?.description ?? "").trim();
    const result =
      from === "Target Met"
        ? " The reduction target was met."
        : from === "Target Missed"
          ? " The reduction target was not fully met."
          : "";

    const messages: Record<string, [string[], string]> = {
      "Forwarded to Finance": [finance(), `Wastage case ${ref} needs a cost estimate for its remedy.`],
      "Returned to SO": [officers(), `Finance added cost figures to wastage case ${ref}.`],
      "Verify Target": [officers(), `The target deadline for wastage case ${ref} has passed; check whether it was met.`],
      Closed: [
        this.linkedReporters(report),
        `Update on the waste you reported${where ? ` at ${where}` : ""}: the Sustainability Officer has acted on it` +
          (remedy ? ` (${remedy}).` : ".") +
          result,
      ],
    };
    const entry = messages[to];
    if (!entry || entry[0].length === 0) return;
    pushNotifications(this.database, {
      organizationId: org,
      userIds: entry[0],
      targetType: NotificationTargetType.WASTAGE,
      targetId: report.wastage_report_id,
      message: entry[1],
    });
  }

  /**
   * Opens a case. Only the Sustainability Officer (or Org Admin) does this,
   * from a hotspot of waste issues or from monitoring; occupants report
   * incidents as issues instead. The linked tickets must exist in this
   * organisation.
   */
  create(createDto: CreateWastageReportDto, userId?: string) {
    // The case belongs to the signed-in officer, whatever the body says.
    if (userId && this.database.users.some((u) => u.user_id === userId)) {
      createDto = { ...createDto, reporter_id: userId };
    }
    if (createDto.reporter_id) {
      const exists = this.database.users.find(
        (x) => x.user_id === createDto.reporter_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target users with id '${createDto.reporter_id}' not found`,
        );
    }
    if (createDto.sensor_reading_id) {
      const exists = this.database.meterReadings.find(
        (x) => x.reading_id === createDto.sensor_reading_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target meterReadings with id '${createDto.sensor_reading_id}' not found`,
        );
    }
    if (createDto.status !== undefined && canonicalStatus(createDto.status) !== "Open")
      throw new BadRequestException(`A new wastage case must start as 'Open'`);

    const sources = this.checkSources(createDto.source_request_ids);

    const generatedId = crypto.randomUUID();
    const newRecord = {
      wastage_report_id: generatedId,
      ...createDto,
      source_request_ids: sources,
      status: "Open",
      organization_id: currentOrgId() ?? createDto.organization_id ?? null,
      created_at: new Date().toISOString(),
    };
    this.database.wastageReports.push(newRecord as any);
    return newRecord;
  }
  attachPhotos(id: string, files: Express.Multer.File[], userId?: string, role?: string) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`Wastage Report with ID ${id} not found`);
    this.assertVisitorMayAct(this.database.wastageReports[index], userId, role);

    const photoPaths = files.map((f) => f.path);
    const currentDetails = this.database.wastageReports[index].details;
    const existingDetails =
      currentDetails && typeof currentDetails === "object" && !Array.isArray(currentDetails)
        ? currentDetails
        : {};

    this.database.wastageReports[index] = {
      ...this.database.wastageReports[index],
      details: {
        ...existingDetails,
        photos: [...(existingDetails.photos ?? []), ...photoPaths],
      },
    } as any;
    return this.withPhotoUrls(this.database.wastageReports[index]);
  }

  /**
   * Resolves one attached photo's on-disk path for GET :id/photos/:filename.
   *
   * The filename must exactly match the basename of a path already recorded
   * on this report — it selects among files this report's own uploads put
   * there, never an arbitrary path a caller could otherwise type into the
   * URL.
   */
  getPhotoPath(id: string, filename: string, userId?: string, role?: string): string {
    const record = assertTenantOwns(
      this.database.wastageReports.find((item) => item.wastage_report_id === id),
    ) as any;
    if (!record)
      throw new NotFoundException(`Wastage Report with ID ${id} not found`);
    this.assertVisitorMayAct(record, userId, role);

    const photos: string[] = record.details?.photos ?? [];
    const match = photos.find((p) => nodePath.basename(p) === filename);
    if (!match)
      throw new NotFoundException(
        `Photo '${filename}' not found on wastage report ${id}`,
      );
    if (!fs.existsSync(match))
      throw new NotFoundException(
        `Photo '${filename}' is no longer on disk`,
      );
    return match;
  }

  /**
   * Replaces the raw on-disk photo paths with URLs the frontend can fetch,
   * the same way invoices.service.ts keeps document_path server-side only
   * and hands back a route instead. Without this, GET /wastage-reports would
   * leak the server's local filesystem layout, and a browser has no use for
   * a raw path anyway.
   */
  private withPhotoUrls(record: any) {
    if (!record?.details) return record;

    const rawPhotos: string[] = record.details.photos ?? [];
    // photo_urls only ever means something alongside the photos it was
    // computed from — always dropped and, when photos is non-empty,
    // recomputed fresh, so a record whose photos was ever wiped (or one
    // updated before this fix existed) can't keep echoing a stale,
    // now-unresolvable photo_urls back to the client.
    const { photos, photo_urls, ...restDetails } = record.details;
    if (rawPhotos.length === 0) {
      return { ...record, details: restDetails };
    }

    return {
      ...record,
      details: {
        ...restDetails,
        photo_urls: rawPhotos.map(
          (p) =>
            `/wastage-reports/${record.wastage_report_id}/photos/${nodePath.basename(p)}`,
        ),
      },
    };
  }

  /**
   * A visitor sees a case only when it grew out of an issue they reported
   * (or, for older records, one they filed themselves); staff see the
   * organisation's.
   */
  /**
   * The linked issue reports, de-duplicated, each checked to exist in the
   * caller's organisation (404 otherwise). Used on create, PUT and PATCH.
   */
  private checkSources(ids: string[] | undefined): string[] {
    const sources = [...new Set(ids ?? [])];
    const tickets = scopeToTenant(this.database.serviceRequests);
    const missing = sources.filter((id) => !tickets.some((t) => t.service_request_id === id));
    if (missing.length)
      throw new NotFoundException(`Issue report(s) not found: ${missing.join(", ")}`);
    return sources;
  }

  /** Campus Visitor, or a role that passes as one (Department Head). */
  private static isVisitor(role?: string): boolean {
    return role === UserRole.CAMPUS_VISITOR || !!(role && ROLE_EQUIVALENTS[role]?.includes(UserRole.CAMPUS_VISITOR));
  }

  /**
   * Comments, photos and archiving are for a visitor's own older reports
   * only. A case that grew from their issue is the officer's: they may read
   * what came of it, not act on it. Anything else is a 404, like a missing id.
   */
  private assertVisitorMayAct(record: WastageReport, userId?: string, role?: string) {
    if (WastageReportsService.isVisitor(role) && (!userId || record.reporter_id !== userId))
      throw new NotFoundException(`WastageReport with ID ${record.wastage_report_id} not found`);
  }

  /**
   * What a visitor sees of a case behind their report: what it is about,
   * where it stands and the fix. Never Finance's figures, the officer's
   * notes and comments, or other people's reports. Their own older reports
   * they filed themselves come back whole.
   */
  private visitorView(r: WastageReport, userId?: string) {
    if (userId && r.reporter_id === userId) return this.withPhotoUrls(r);
    const d = r.details ?? {};
    const mine = (r.source_request_ids ?? []).filter((id) => {
      const t = this.database.serviceRequests.find((x) => x.service_request_id === id);
      return !!t && !!userId && [t.reporter_id, ...(t.reporter_ids ?? [])].includes(userId);
    });
    return {
      wastage_report_id: r.wastage_report_id,
      organization_id: r.organization_id,
      type: r.type,
      status: r.status,
      created_at: r.created_at,
      source_request_ids: mine,
      details: {
        title: d.title,
        location: d.location,
        ...(d.remedy?.description ? { remedy: { description: d.remedy.description } } : {}),
        ...(d.archived ? { archived: true } : {}),
      },
    };
  }

  private visibleToVisitor(r: WastageReport, userId?: string): boolean {
    if (!userId) return false;
    return r.reporter_id === userId || this.linkedReporters(r).includes(userId);
  }

  findAll(userId?: string, role?: string) {
    this.promoteDueTargets();
    const all = scopeToTenant(this.database.wastageReports);
    if (WastageReportsService.isVisitor(role))
      return all.filter((r) => this.visibleToVisitor(r, userId)).map((r) => this.visitorView(r, userId));
    return all.map((r) => this.withPhotoUrls(r));
  }

  /**
   * A report whose target deadline has passed moves from Target Set to
   * Verify Target by itself, and the officers are asked to check it.
   */
  private promoteDueTargets() {
    const today = new Date().toISOString().slice(0, 10);
    for (const r of scopeToTenant(this.database.wastageReports)) {
      const deadline = r.details?.metricTarget?.deadline;
      if (r.status === "Target Set" && typeof deadline === "string" && deadline < today) {
        r.status = "Verify Target";
        this.notifyStatus(r, "Verify Target");
      }
    }
  }

  /**
   * The evidence for Target Met or Missed, from the meter behind the report
   * (sensor_reading_id → reading → meter).
   *
   * The target is in the sensor's units (e.g. L/min) but the meter records
   * monthly totals, so the target is turned into a percentage cut —
   * 1 − target ÷ the reading that triggered the report — and the meter's
   * actual change is measured like for like: each full month since the
   * target was set against the same month a year earlier. The officer makes
   * the decision; this only suggests one, and says when it cannot.
   */
  targetCheck(id: string) {
    const report = assertTenantOwns(
      this.database.wastageReports.find((r) => r.wastage_report_id === id),
    );
    if (!report) throw new NotFoundException(`WastageReport with ID ${id} not found`);
    const target = report.details?.metricTarget;
    if (!target) throw new BadRequestException("This report has no target yet.");
    if (report.type === "Food") return this.foodTargetCheck(report, target);

    const reading = this.database.meterReadings.find((r) => r.reading_id === report.sensor_reading_id);
    const meter = reading && this.database.meters.find((m) => m.meter_id === reading.meter_id);
    const base = { target: { value: target.value, unit: target.unit, deadline: target.deadline, set_at: target.setAt ?? report.details?.targetSetAt ?? null } };
    if (!meter) return { ...base, meter: null, suggested: null, reason: "This report is not linked to a meter, so the outcome cannot be measured. Decide from what you know." };

    const triggering = Number(report.details?.systemData?.readingValue);
    const required =
      Number.isFinite(triggering) && triggering > 0 && Number(target.value) < triggering
        ? Number(((1 - Number(target.value) / triggering) * 100).toFixed(1))
        : null;

    const setAt = String(base.target.set_at ?? "").slice(0, 7);
    const deadlineMonth = String(target.deadline).slice(0, 7);
    const last = lastFullMonth();
    const from = setAt ? addMonths(setAt, 1) : null;
    const to = deadlineMonth < last ? deadlineMonth : last;
    const months = from && from <= to ? periodsBetween(from, to) : [];
    const cmp = compareYoY(meterSum(this.database, [meter.meter_id]), months);
    const achieved = cmp.months_compared > 0 ? Number((-cmp.change_pct).toFixed(1)) : null;

    let suggested: "Target Met" | "Target Missed" | null = null;
    let reason: string;
    if (achieved === null) reason = "There is no full month of readings since the target was set (with last year to compare), so the outcome cannot be measured yet.";
    else if (required === null) reason = "The target could not be turned into a percentage cut (no triggering reading to compare it with).";
    else {
      suggested = achieved >= required ? "Target Met" : "Target Missed";
      reason = `The meter is ${Math.abs(achieved)}% ${achieved >= 0 ? "lower" : "higher"} than the same months last year; the target needed a ${required}% cut.`;
    }
    return {
      ...base,
      meter: { meter_id: meter.meter_id, meter_code: meter.meter_code, meter_type: meter.meter_type },
      required_reduction_pct: required,
      achieved_reduction_pct: achieved,
      months_compared: cmp.months_compared,
      months: cmp.months,
      suggested,
      reason,
    };
  }

  /**
   * Food has no meter: its target (kg a day) is checked against the
   * General Maintenance weigh-ins for the case's place. The baseline is the
   * 30 days before the target was set; the outcome is the days since.
   */
  private foodTargetCheck(report: WastageReport, target: any) {
    const place = WastageReportsService.whereOf(report);
    const setAt = String(target.setAt ?? report.details?.targetSetAt ?? "").slice(0, 10);
    const base = {
      target: { value: target.value, unit: target.unit, deadline: target.deadline, set_at: target.setAt ?? report.details?.targetSetAt ?? null },
      meter: null,
    };
    const logs = scopeToTenant(this.database.foodWasteLogs).filter((l) => placeKey(l.location) === placeKey(place));
    if (!place || logs.length === 0)
      return {
        ...base,
        food: { location: place, baseline_kg_per_day: null, achieved_kg_per_day: null, days_logged: 0 },
        suggested: null,
        reason: `No food waste has been logged for ${place || "this case's place"}, so the outcome cannot be measured. Ask General Maintenance to log the bins, or decide from what you know.`,
      };

    const today = new Date().toISOString().slice(0, 10);
    const before = setAt ? new Date(Date.parse(setAt) - 30 * 86_400_000).toISOString().slice(0, 10) : "";
    const end = String(target.deadline) < today ? String(target.deadline) : today;
    const baseline = setAt ? kgPerDay(logs.filter((l) => l.date >= before && l.date < setAt)) : null;
    const sinceLogs = setAt ? logs.filter((l) => l.date >= setAt && l.date <= end) : [];
    const achieved = kgPerDay(sinceLogs);
    const days = new Set(sinceLogs.map((l) => l.date)).size;
    const value = Number(target.value);
    const required = baseline && value < baseline ? Number(((1 - value / baseline) * 100).toFixed(1)) : null;
    const achievedPct = baseline && achieved !== null ? Number(((1 - achieved / baseline) * 100).toFixed(1)) : null;

    let suggested: "Target Met" | "Target Missed" | null = null;
    let reason: string;
    if (!setAt) reason = "The target has no start date, so there is nothing to compare.";
    else if (achieved === null || days < 7)
      reason = `Only ${days} day(s) of weigh-ins since the target was set; at least 7 are needed to judge it.`;
    else {
      suggested = achieved <= value ? "Target Met" : "Target Missed";
      reason =
        `Food waste averaged ${achieved} kg a day over ${days} logged days, against a target of ${value} kg a day` +
        (baseline ? ` (it was ${baseline} kg a day before the target).` : ".");
    }
    return {
      ...base,
      food: { location: place, baseline_kg_per_day: baseline, achieved_kg_per_day: achieved, days_logged: days },
      required_reduction_pct: required,
      achieved_reduction_pct: achievedPct,
      months_compared: 0,
      months: [],
      suggested,
      reason,
    };
  }

  // ── Waste signals ──────────────────────────────────────────────────────

  /** A ticket's place in words: building, floor, area and room. */
  private placeOf(t: { building_id?: string | null; floor?: string; area?: string; part?: string }): string {
    const building = this.database.buildings.find((b) => b.building_id === t.building_id);
    const floor = FLOORS.find((f) => f.id === t.floor)?.label ?? t.floor;
    const area = AREAS.find((a) => a.id === t.area)?.label ?? t.area;
    const part = PARTS[t.area as AreaId]?.find((x) => x.id === t.part)?.label ?? t.part ?? "";
    const whole = t.floor === "whole_building" || t.floor === "outside";
    return [
      building?.name,
      t.floor === "whole_building" ? null : t.floor === "outside" ? "outside" : floor ? `floor ${floor}` : null,
      whole ? null : area ? String(area).toLowerCase() : null,
      part,
    ]
      .filter(Boolean)
      .join(", ");
  }

  /** True for a ticket that reports waste: a WASTE-tagged problem, or an item that alerts the officer. */
  private static isWasteTicket(t: { item_id?: string | null; problem_id?: string | null }): boolean {
    if (!t.item_id) return false;
    if (alertsOfficer(t.item_id)) return true;
    const found = findItem(t.item_id);
    const prob = found && t.problem_id ? findProblem(found.item, t.problem_id) : undefined;
    return !!prob?.tags?.includes("WASTE");
  }

  /**
   * What the Sustainability Officer works from instead of single reports:
   * - waste issue reports grouped by place and kind over the last 30 days
   *   (a hotspot at 3 or more, or at once for food thrown away or smoke);
   * - places whose food waste rose this week (General Maintenance weigh-ins);
   * - meters well above the same month last year.
   * Every group is returned; `hotspot` marks the ones the rule flags.
   */
  signals(): WasteSignal[] {
    const org = currentOrgId();
    const since = new Date(Date.now() - SIGNAL_WINDOW_DAYS * 86_400_000).toISOString();
    const cases = scopeToTenant(this.database.wastageReports).filter((r) => ACTIVE_CASE.includes(canonicalStatus(r.status)));
    const caseFor = (ticketIds: string[], key: string) =>
      cases.find((c) => c.details?.signalKey === key || (c.source_request_ids ?? []).some((id) => ticketIds.includes(id)))
        ?.wastage_report_id ?? null;
    const watches = this.database.wastageWatches.filter((w) => !org || w.organization_id === org);
    const watchedAt = (key: string) => watches.find((w) => w.key === key)?.watched_at ?? null;
    const out: WasteSignal[] = [];

    // 1. Waste issue reports, by place and kind.
    const groups = new Map<string, ServiceRequestLike[]>();
    for (const t of scopeToTenant(this.database.serviceRequests) as ServiceRequestLike[]) {
      if (t.source_wastage || !WastageReportsService.isWasteTicket(t) || String(t.created_at ?? "") < since) continue;
      const kind = wasteKindOf(t.issue_type_id, t.item_id);
      if (!kind) continue;
      const key = ["reports", kind, t.building_id ?? "", t.floor ?? "", t.area ?? "", cleanPart(t.part ?? "")].join("|");
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    for (const [key, tickets] of groups) {
      const kind = key.split("|")[1] as WasteKind;
      const people = new Set(
        tickets.flatMap((t) => [t.reporter_id, ...(t.reporter_ids ?? []), ...(t.plus_one_ids ?? [])]).filter((x) => x && x !== "system"),
      );
      const last = tickets.map((t) => String(t.created_at)).sort().pop() ?? null;
      const observed = tickets.some((t) => alertsOfficer(t.item_id));
      const reasons: string[] = [];
      if (tickets.length >= HOTSPOT_INCIDENTS) reasons.push(`${tickets.length} reports in ${SIGNAL_WINDOW_DAYS} days`);
      if (observed) reasons.push(kind === "Food" ? "Food reported thrown away" : "Smoke or burning reported");
      const ids = tickets.map((t) => t.service_request_id);
      const w = watchedAt(key);
      out.push({
        key,
        kind,
        source: "reports",
        location: this.placeOf(tickets[0]),
        building_id: tickets[0].building_id ?? null,
        incidents: tickets.length,
        people: people.size,
        last_at: last,
        ticket_ids: ids,
        sensor_reading_id: null,
        reasons,
        hotspot: reasons.length > 0,
        // Watching lapses when a new report arrives after it.
        watched: !!w && (last ?? "") <= w,
        case_id: caseFor(ids, key),
      });
    }

    // 2. Food weigh-ins rising this week.
    const byPlace = new Map<string, FoodWasteLog[]>();
    for (const l of scopeToTenant(this.database.foodWasteLogs))
      byPlace.set(placeKey(l.location), [...(byPlace.get(placeKey(l.location)) ?? []), l]);
    const week = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const month = since.slice(0, 10);
    for (const [place, logs] of byPlace) {
      const last7 = kgPerDay(logs.filter((l) => l.date > week));
      const last30 = kgPerDay(logs.filter((l) => l.date > month));
      if (last30 === null) continue;
      const key = `food_log|${place}`;
      const rising = last7 !== null && last7 > last30 * 1.1;
      const last = logs.map((l) => l.created_at).sort().pop() ?? null;
      const w = watchedAt(key);
      out.push({
        key,
        kind: "Food",
        source: "food_log",
        location: logs[0].location,
        building_id: logs[0].building_id ?? null,
        incidents: logs.filter((l) => l.date > month).length,
        people: 0,
        last_at: last,
        ticket_ids: [],
        sensor_reading_id: null,
        reasons: rising
          ? [`${last7} kg a day this week, up from ${last30} kg a day over ${SIGNAL_WINDOW_DAYS} days`]
          : [`${last30} kg a day over ${SIGNAL_WINDOW_DAYS} days`],
        hotspot: rising,
        watched: !!w && (last ?? "") <= w,
        case_id: caseFor([], key),
      });
    }

    // 3. Meters well above the same month last year.
    const lastMonth = lastFullMonth();
    const kindOfMeter: Record<string, WasteKind> = { electricity: "Energy", gas: "Energy", water: "Water", emissions: "Emissions", food: "Food" };
    for (const meter of scopeToTenant(this.database.meters)) {
      const kind = kindOfMeter[meter.meter_type];
      if (!kind) continue;
      const cmp = compareYoY(meterSum(this.database, [meter.meter_id]), [lastMonth]);
      if (cmp.months_compared === 0 || cmp.change_pct <= METER_RISE_PCT) continue;
      const key = `meter|${meter.meter_id}|${lastMonth}`;
      const building = this.database.buildings.find((b) => b.building_id === meter.building_id);
      const reading = this.database.meterReadings
        .filter((r) => r.meter_id === meter.meter_id)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      out.push({
        key,
        kind,
        source: "meter",
        location: [building?.name, meter.zone, meter.meter_code].filter(Boolean).join(", "),
        building_id: meter.building_id,
        incidents: 0,
        people: 0,
        last_at: reading?.timestamp ?? null,
        ticket_ids: [],
        sensor_reading_id: reading?.reading_id ?? null,
        reasons: [`${meter.meter_code} used ${cmp.change_pct}% more in ${lastMonth} than a year earlier`],
        hotspot: true,
        watched: !!watchedAt(key),
        case_id: caseFor([], key),
      });
    }

    // Hotspots first, then the rest, then watched, then those with a case.
    const rank = (x: WasteSignal) => (x.case_id ? 3 : x.watched ? 2 : x.hotspot ? 0 : 1);
    return out.sort((a, b) => rank(a) - rank(b) || String(b.last_at).localeCompare(String(a.last_at)));
  }

  /** Watch a signal instead of opening a case; a new report brings it back. */
  watch(key: string, userId?: string) {
    if (!key) throw new BadRequestException("Which signal? Send its key.");
    const org = currentOrgId() ?? "";
    const at = new Date().toISOString();
    const existing = this.database.wastageWatches.find((w) => w.organization_id === org && w.key === key);
    if (existing) existing.watched_at = at;
    else this.database.wastageWatches.push({ organization_id: org, key, watched_at: at, watched_by: userId ?? null });
    return { key, watched_at: at };
  }

  unwatch(key: string) {
    const org = currentOrgId() ?? "";
    this.database.wastageWatches = this.database.wastageWatches.filter((w) => !(w.organization_id === org && w.key === key));
    return { key, watched: false };
  }

  findOne(id: string, userId?: string, role?: string) {
    this.promoteDueTargets();
    const record = assertTenantOwns(this.database.wastageReports.find(
      (item) => item.wastage_report_id === id,
    ));
    const visitor = WastageReportsService.isVisitor(role);
    if (!record || (visitor && !this.visibleToVisitor(record, userId)))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);
    return visitor ? this.visitorView(record, userId) : this.withPhotoUrls(record);
  }

  put(id: string, putDto: PutWastageReportDto, role?: string) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`Wastage Report with ID ${id} not found`);
    const existing = this.database.wastageReports[index];
    const from = canonicalStatus(existing.status);
    const to = canonicalStatus(putDto.status ?? existing.status);
    // A full replace cannot be used to skip the workflow either.
    assertWastageMove(role, from, to);
    assertRemedyRule(from, to, putDto.details);
    const sources = this.checkSources(putDto.source_request_ids);
    this.database.wastageReports[index] = {
      wastage_report_id: id,
      ...putDto,
      source_request_ids: sources,
      organization_id: existing.organization_id,
      created_at: existing.created_at,
    } as any;
    if (from !== to) this.notifyStatus(this.database.wastageReports[index], to, from);
    return this.database.wastageReports[index];
  }
  /**
   * Adds one comment to a report. Separate from update() so a Campus
   * Visitor can comment without being able to change anything else (status,
   * cost figures, ...). The comment is appended here on the server, so two
   * people commenting at once cannot overwrite each other.
   */
  addComment(id: string, dto: AddWastageCommentDto, role: string | undefined, userId?: string) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);
    this.assertVisitorMayAct(this.database.wastageReports[index], userId, role);

    const existing = this.database.wastageReports[index];
    const details = existing.details || {};
    const comment = {
      author: dto.author?.trim() || role || "Unknown",
      role: role || "Unknown",
      text: dto.text.trim(),
      timestamp: new Date().toISOString(),
    };
    this.database.wastageReports[index] = {
      ...existing,
      details: { ...details, comments: [...(details.comments ?? []), comment] },
    };
    return this.withPhotoUrls(this.database.wastageReports[index]);
  }

  /** Statuses a report can be archived from: it is over, one way or another. */
  private static readonly ARCHIVABLE = [
    "Target Set",
    "Target Met",
    "Target Missed",
    "Closed",
    "Dismissed",
  ];

  /**
   * Archives a report the visitor is done with. Only allowed once the
   * report is finished or dismissed, so an active report cannot be hidden
   * from the visitor's list while it is still being worked on.
   */
  archive(id: string, userId?: string, role?: string) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);
    this.assertVisitorMayAct(this.database.wastageReports[index], userId, role);

    const existing = this.database.wastageReports[index];
    if (!WastageReportsService.ARCHIVABLE.includes(canonicalStatus(existing.status)))
      throw new BadRequestException(
        `Only a finished or dismissed report can be archived (this one is '${existing.status}')`,
      );

    const details = existing.details || {};
    this.database.wastageReports[index] = {
      ...existing,
      details: {
        ...details,
        archived: true,
        archivedAt: details.archivedAt ?? new Date().toISOString(),
      },
    };
    return this.withPhotoUrls(this.database.wastageReports[index]);
  }

  /**
   * Edits a report. A change of status must be a move the caller's role is
   * allowed to make (see OFFICER_MOVES / FINANCE_MOVES), otherwise 403;
   * saving the same status with other changes is always fine.
   */
  update(id: string, updateDto: UpdateWastageReportDto, role?: string) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);

    const existing = this.database.wastageReports[index];
    const from = canonicalStatus(existing.status);
    const to = updateDto.status !== undefined ? canonicalStatus(updateDto.status) : from;
    assertWastageMove(role, from, to);

    // GET /wastage-reports hands back details.photo_urls, never the raw
    // details.photos it is computed from (see withPhotoUrls). Every caller
    // that patches a report by round-tripping a fresh GET into this
    // details object — which is every status-change action on the
    // Sustainability Officer's audit queue — was therefore silently wiping
    // out whichever photos a Campus Visitor had attached, the first time
    // anyone so much as validated or commented on their report. photos is
    // the only real record of what was uploaded, so it survives here
    // regardless of what the incoming details object does or doesn't
    // mention, and a client-echoed photo_urls is dropped rather than
    // stored, since it is derived, not authored.
    let mergedDetails = existing.details;
    if (updateDto.details) {
      const { photo_urls: _ignored, ...incomingDetails } =
        updateDto.details as any;
      mergedDetails = {
        ...incomingDetails,
        ...(existing.details?.photos
          ? { photos: existing.details.photos }
          : {}),
      };
    }

    assertRemedyRule(from, to, mergedDetails);
    if (updateDto.source_request_ids !== undefined)
      updateDto = { ...updateDto, source_request_ids: this.checkSources(updateDto.source_request_ids) };

    this.database.wastageReports[index] = {
      ...existing,
      ...updateDto,
      // Keep the stored spelling when the status did not really change
      // (a "pending" report saved as "Reported" stays as it was).
      status: from === to ? existing.status : to,
      details: mergedDetails,
      organization_id: existing.organization_id,
      created_at: existing.created_at,
    };
    if (from !== to) this.notifyStatus(this.database.wastageReports[index], to, from);
    return this.withPhotoUrls(this.database.wastageReports[index]);
  }

  remove(id: string) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);
    const removed = this.database.wastageReports.splice(index, 1);
    // Its notifications would point at a report that no longer exists.
    this.database.notifications = this.database.notifications.filter(
      (n) => !(n.target_type === NotificationTargetType.WASTAGE && n.target_id === id),
    );
    return removed[0];
  }

  /** Turns a case's physical remedy into a job in the same assignment engine. */
  raiseWorkOrder(id: string) {
    const record = assertTenantOwns(this.database.wastageReports.find((r) => r.wastage_report_id === id));
    if (!record) throw new NotFoundException(`WastageReport with ID ${id} not found`);
    const raisable = ["Open", "Forwarded to Finance", "Cost Impact Added", "Returned to SO", "Target Set", "Verify Target", "Target Missed"];
    if (!raisable.includes(canonicalStatus(record.status)))
      throw new BadRequestException(`A work order can only be raised for an active case (this one is '${record.status}').`);
    const result = this.dispatch.sendWastage(record);
    record.details = { ...(record.details ?? {}), workOrderRaisedAt: new Date().toISOString(), workOrderTicketId: result.ticket_id };
    return result;
  }
}
