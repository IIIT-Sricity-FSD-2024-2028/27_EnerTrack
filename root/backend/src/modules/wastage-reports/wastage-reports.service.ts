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
  NotificationTargetType,
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
import { PutWastageReportDto } from "./dto/put-wastage-report.dto";

import { UpdateWastageReportDto } from "./dto/update-wastage-report.dto";
import { AddWastageCommentDto } from "./dto/add-wastage-comment.dto";

/**
 * The wastage workflow, enforced here rather than by which buttons a page
 * happens to show. Seeded reports use "pending", which means "Reported".
 *
 *   Reported ──► Validated ──► Forwarded to Finance ──► Cost Impact Added
 *      │             │                ▲                        │
 *      ▼             ▼                │                        ▼
 *   Dismissed     Target Set ◄── Returned to SO ◄──────────────┘
 *                  │     ▲
 *   (deadline or   ▼     │ (try again)
 *    checked early) Verify Target ──► Target Met ──► Delivered
 *                        └──────────► Target Missed ──► Delivered
 *
 * Older reports may still be "Finalized" (the step before T14); they can
 * still be delivered, and Target Set → Finalized is kept for them.
 */
const OFFICER_MOVES: Record<string, string[]> = {
  Reported: ["Validated", "Dismissed"],
  Validated: ["Forwarded to Finance", "Target Set", "Finalized", "Dismissed"],
  "Returned to SO": ["Target Set", "Forwarded to Finance", "Finalized", "Dismissed"],
  "Target Set": ["Verify Target", "Finalized", "Delivered"],
  "Verify Target": ["Target Met", "Target Missed"],
  "Target Met": ["Delivered"],
  "Target Missed": ["Delivered", "Target Set"],
  Finalized: ["Delivered"],
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
 * The workflow check for a status change. A report sitting in a status the
 * workflow does not know (an older record) is not blocked.
 */
function assertWastageMove(role: string | undefined, from: string, to: string) {
  if (!KNOWN_STATUSES.has(from)) return;
  assertMove(WORKFLOW, role, from, to, "a wastage report");
}

/** "pending" (seed) and "reported" mean the same thing: "Reported". */
function canonicalStatus(status: string | undefined | null): string {
  if (!status) return "Reported";
  return status.trim().toLowerCase() === "pending" || status.trim().toLowerCase() === "reported"
    ? "Reported"
    : status;
}

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

  /** Who hears about a move, and what they are told. */
  private notifyStatus(report: WastageReport, to: string) {
    const ref = reportRef(report.wastage_report_id);
    const kind = String(report.type || "wastage").toLowerCase();
    const org = report.organization_id;
    const reporter = [report.reporter_id];
    const officers = () => usersWithRole(this.database, org, [UserRole.SUSTAINABILITY_OFFICER]);
    const finance = () => usersWithRole(this.database, org, [UserRole.FINANCIAL_ANALYST]);

    const messages: Record<string, [string[], string]> = {
      Validated: [reporter, `Your ${kind} report ${ref} has been confirmed and is being looked into.`],
      Dismissed: [
        reporter,
        `Your ${kind} report ${ref} was closed without action` +
          (report.details?.dismissReason ? `: ${report.details.dismissReason}.` : "."),
      ],
      "Forwarded to Finance": [finance(), `Wastage report ${ref} needs a cost estimate.`],
      "Returned to SO": [officers(), `Finance added cost figures to wastage report ${ref}.`],
      "Target Set": [reporter, `A reduction target has been set for your ${kind} report ${ref}.`],
      "Verify Target": [officers(), `The target deadline for wastage report ${ref} has passed; check whether it was met.`],
      "Target Met": [reporter, `Good news: the reduction target for your ${kind} report ${ref} was met.`],
      "Target Missed": [reporter, `The reduction target for your ${kind} report ${ref} was not met. The Sustainability Officer is following it up.`],
      Finalized: [reporter, `Your ${kind} report ${ref} has been finalised.`],
      Delivered: [reporter, `The outcome of your ${kind} report ${ref} is ready to read.`],
    };
    const entry = messages[to];
    if (!entry) return;
    pushNotifications(this.database, {
      organizationId: org,
      userIds: entry[0],
      targetType: NotificationTargetType.WASTAGE,
      targetId: report.wastage_report_id,
      message: entry[1],
    });
  }

  create(createDto: CreateWastageReportDto, userId?: string) {
    // The reporter is the signed-in person, whatever the body says.
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
    // A new report always starts as Reported. Later statuses (Validated,
    // Delivered, ...) are set by the officer and Finance through PATCH.
    if (
      createDto.status !== undefined &&
      createDto.status.toLowerCase() !== "reported"
    )
      throw new BadRequestException(
        `A new wastage report must start as 'Reported'`,
      );

    const generatedId = crypto.randomUUID();
    const newRecord = {
      wastage_report_id: generatedId,
      ...createDto,
      status: "Reported",
      organization_id: currentOrgId() ?? createDto.organization_id ?? null,
      created_at: new Date().toISOString(),
    };
    this.database.wastageReports.push(newRecord as any);

    const where = createDto.details?.specificData?.location;
    pushNotifications(this.database, {
      organizationId: newRecord.organization_id,
      userIds: usersWithRole(this.database, newRecord.organization_id, [UserRole.SUSTAINABILITY_OFFICER]),
      targetType: NotificationTargetType.WASTAGE,
      targetId: generatedId,
      message: `New ${String(createDto.type || "wastage").toLowerCase()} wastage report ${reportRef(generatedId)}${where ? ` at ${where}` : ""}.`,
    });
    return newRecord;
  }
  attachPhotos(id: string, files: Express.Multer.File[]) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`Wastage Report with ID ${id} not found`);

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
  getPhotoPath(id: string, filename: string): string {
    const record = assertTenantOwns(
      this.database.wastageReports.find((item) => item.wastage_report_id === id),
    ) as any;
    if (!record)
      throw new NotFoundException(`Wastage Report with ID ${id} not found`);

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

  /** Visitors see only their own reports; staff see the organisation's. */
  findAll(userId?: string, role?: string) {
    this.promoteDueTargets();
    const all = scopeToTenant(this.database.wastageReports);
    const visible = role === "Campus Visitor" ? all.filter((r) => r.reporter_id === userId) : all;
    return visible.map((r) => this.withPhotoUrls(r));
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

  findOne(id: string, userId?: string, role?: string) {
    this.promoteDueTargets();
    const record = assertTenantOwns(this.database.wastageReports.find(
      (item) => item.wastage_report_id === id,
    ));
    if (!record || (role === "Campus Visitor" && record.reporter_id !== userId))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);
    return this.withPhotoUrls(record);
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
    this.database.wastageReports[index] = {
      wastage_report_id: id,
      ...putDto,
      organization_id: existing.organization_id,
      created_at: existing.created_at,
    } as any;
    if (from !== to) this.notifyStatus(this.database.wastageReports[index], to);
    return this.database.wastageReports[index];
  }
  /**
   * Adds one comment to a report. Separate from update() so a Campus
   * Visitor can comment without being able to change anything else (status,
   * cost figures, ...). The comment is appended here on the server, so two
   * people commenting at once cannot overwrite each other.
   */
  addComment(id: string, dto: AddWastageCommentDto, role: string | undefined) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);

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
    "Finalized",
    "Target Set",
    "Target Met",
    "Target Missed",
    "Delivered",
    "Dismissed",
  ];

  /**
   * Archives a report the visitor is done with. Only allowed once the
   * report is finished or dismissed, so an active report cannot be hidden
   * from the visitor's list while it is still being worked on.
   */
  archive(id: string) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);

    const existing = this.database.wastageReports[index];
    if (!WastageReportsService.ARCHIVABLE.includes(existing.status))
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
    if (from !== to) this.notifyStatus(this.database.wastageReports[index], to);
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

  /** Turns a validated report into a job in the same assignment engine. */
  raiseWorkOrder(id: string) {
    const record = assertTenantOwns(this.database.wastageReports.find((r) => r.wastage_report_id === id));
    if (!record) throw new NotFoundException(`WastageReport with ID ${id} not found`);
    const raisable = ["Validated", "Forwarded to Finance", "Cost Impact Added", "Returned to SO", "Target Set", "Verify Target", "Target Missed", "Finalized"];
    if (!raisable.includes(record.status))
      throw new BadRequestException(`Validate the report first (it is '${record.status}').`);
    const result = this.dispatch.sendWastage(record);
    record.details = { ...(record.details ?? {}), workOrderRaisedAt: new Date().toISOString(), workOrderTicketId: result.ticket_id };
    return result;
  }
}
