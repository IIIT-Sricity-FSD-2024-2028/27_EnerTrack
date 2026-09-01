import * as crypto from "crypto";
import * as fs from "fs";
import * as nodePath from "path";
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { CreateWastageReportDto } from "./dto/create-wastage-report.dto";
import { PutWastageReportDto } from "./dto/put-wastage-report.dto";

import { UpdateWastageReportDto } from "./dto/update-wastage-report.dto";

@Injectable()
export class WastageReportsService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateWastageReportDto) {
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
    const generatedId = crypto.randomUUID();
    const newRecord = { wastage_report_id: generatedId, ...createDto, organization_id: currentOrgId() ?? createDto.organization_id ?? null };
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

  findAll() {
    return scopeToTenant(this.database.wastageReports).map((r) =>
      this.withPhotoUrls(r),
    );
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.wastageReports.find(
      (item) => item.wastage_report_id === id,
    ));
    if (!record)
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
  update(id: string, updateDto: UpdateWastageReportDto) {
    const index = this.database.wastageReports.findIndex(
      (item) => item.wastage_report_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.wastageReports[index]))
      throw new NotFoundException(`WastageReport with ID ${id} not found`);

    const existing = this.database.wastageReports[index];

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
    return this.withPhotoUrls(this.database.wastageReports[index]);
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
}
