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
import { DatabaseService, NotificationTargetType } from "../../core/database/database.service";
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

@Injectable()
export class WastageReportsService {
  constructor(
    private database: DatabaseService,
    private dispatch: DispatchService,
  ) {}

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
      created_at: new Date().toISOString(),
      organization_id: currentOrgId() ?? createDto.organization_id ?? null,
    };
    this.database.wastageReports.push(newRecord as any);
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
    const all = scopeToTenant(this.database.wastageReports);
    const visible = role === "Campus Visitor" ? all.filter((r) => r.reporter_id === userId) : all;
    return visible.map((r) => this.withPhotoUrls(r));
  }

  findOne(id: string, userId?: string, role?: string) {
    const record = assertTenantOwns(this.database.wastageReports.find(
      (item) => item.wastage_report_id === id,
    ));
    if (!record || (role === "Campus Visitor" && record.reporter_id !== userId))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);
    return this.withPhotoUrls(record);
  }

  put(id: string, putDto: PutWastageReportDto) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`Wastage Report with ID ${id} not found`);
    this.database.wastageReports[index] = {
      wastage_report_id: id,
      ...putDto,
    } as any;
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
   * Who may move a report from one status to the next. The officer validates,
   * dismisses and finishes; Finance only adds the cost impact and returns it.
   * A status not listed here (older records) is left unchecked.
   */
  private static readonly OFFICER_MOVES: Record<string, string[]> = {
    "Reported": ["Validated", "Dismissed"],
    "Validated": ["Forwarded to Finance", "Target Set", "Finalized", "Dismissed"],
    "Returned to SO": ["Forwarded to Finance", "Target Set", "Finalized", "Dismissed"],
    "Target Set": ["Finalized", "Delivered"],
    "Finalized": ["Delivered"],
  };
  private static readonly FINANCE_MOVES: Record<string, string[]> = {
    "Forwarded to Finance": ["Cost Impact Added"],
    "Cost Impact Added": ["Returned to SO"],
  };

  private assertMove(from: string, to: string, role: string | undefined) {
    if (from === to || role === "Organization Admin" || role === "Super Admin") return;
    const table = role === "Financial Analyst" ? WastageReportsService.FINANCE_MOVES : WastageReportsService.OFFICER_MOVES;
    const known = [...Object.keys(WastageReportsService.OFFICER_MOVES), ...Object.keys(WastageReportsService.FINANCE_MOVES)];
    if (!known.includes(from)) return; // an older status: do not block
    if (!table[from]?.includes(to))
      throw new ForbiddenException(`${role ?? "This role"} cannot move a report from '${from}' to '${to}'.`);
  }

  update(id: string, updateDto: UpdateWastageReportDto, role?: string) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);

    const existing = this.database.wastageReports[index];
    if (updateDto.status !== undefined) this.assertMove(existing.status, updateDto.status, role);

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
      details: mergedDetails,
      organization_id: existing.organization_id,
    };
    if (updateDto.status !== undefined && updateDto.status !== existing.status) {
      this.notifyStatus(this.database.wastageReports[index], updateDto.status);
    }
    return this.withPhotoUrls(this.database.wastageReports[index]);
  }

  /** Tell the people who act next (or the reporter) when a report moves on. */
  private notifyStatus(report: { wastage_report_id: string; organization_id: string; reporter_id: string; type: string }, status: string) {
    const org = report.organization_id;
    const label = `${report.type} wastage report`;
    const tell = (userId: string, message: string) =>
      this.database.notifications.push({
        notification_id: crypto.randomUUID(),
        organization_id: org,
        user_id: userId,
        target_type: NotificationTargetType.WASTAGE,
        target_id: report.wastage_report_id,
        message,
        is_read: false,
      });
    const byRole = (role: string) =>
      this.database.users.filter((u) => u.role === role && u.organization_id === org);

    if (status === "Forwarded to Finance") {
      for (const u of byRole("Financial Analyst")) tell(u.user_id, `A ${label} is waiting for your cost review.`);
    } else if (status === "Returned to SO") {
      for (const u of byRole("Sustainability Officer")) tell(u.user_id, `Finance returned a ${label} with the cost impact.`);
    } else if (["Validated", "Dismissed", "Finalized", "Delivered"].includes(status) && report.reporter_id) {
      const words: Record<string, string> = {
        Validated: "was checked and accepted",
        Dismissed: "was reviewed and closed without action",
        Finalized: "has been finalised",
        Delivered: "is complete",
      };
      tell(report.reporter_id, `Your ${label} ${words[status]}.`);
    }
  }

  remove(id: string) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);
    const removed = this.database.wastageReports.splice(index, 1);
    return removed[0];
  }

  /** Turns a validated report into a job in the same assignment engine. */
  raiseWorkOrder(id: string) {
    const record = assertTenantOwns(this.database.wastageReports.find((r) => r.wastage_report_id === id));
    if (!record) throw new NotFoundException(`WastageReport with ID ${id} not found`);
    const raisable = ["Validated", "Forwarded to Finance", "Cost Impact Added", "Returned to SO", "Target Set", "Finalized"];
    if (!raisable.includes(record.status))
      throw new BadRequestException(`Validate the report first (it is '${record.status}').`);
    const result = this.dispatch.sendWastage(record);
    record.details = { ...(record.details ?? {}), workOrderRaisedAt: new Date().toISOString(), workOrderTicketId: result.ticket_id };
    return result;
  }
}
