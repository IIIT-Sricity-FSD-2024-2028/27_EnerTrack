import { DispatchService } from "../dispatch/dispatch.service";
import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { PutServiceRequestDto } from "./dto/put-service-request.dto";

import { UpdateServiceRequestDto } from "./dto/update-service-request.dto";
import { IssueReportsService } from "./issue-reports.service";
import { Level } from "../issue-catalogue/priority";

/**
 * Fields only staff may see. Students never see priority, size, team, other
 * people's ids or the assignee, which also stops friends pushing a ticket up
 * by comparing notes.
 */
const STAFF_ONLY_FIELDS = [
  "student_notified",
  "confirmed_fixed_at",
  "priority",
  "priority_system",
  "priority_override",
  "priority_rule",
  "priority_source",
  "priority_reasons",
  "priority_history",
  "tier",
  "size",
  "points",
  "team",
  "second_team",
  "dispatch_state",
  "queued_reason",
  "queued_at",
  "queued_reminded_at",
  "reporter_ids",
  "plus_one_ids",
  "joined_reports",
  "answers",
  "filed_as",
  "assigned_to_id",
];

/**
 * What any reader gets: the "still broken" photo's place on disk is never
 * sent, only whether there is one (GET /service-requests/:id/reopen-photo
 * streams it).
 */
function withoutFilePaths<T extends { reopen_photo?: string | null }>(record: T): Omit<T, "reopen_photo"> & { has_reopen_photo: boolean } {
  const { reopen_photo, ...rest } = record;
  return { ...rest, has_reopen_photo: !!reopen_photo };
}

function stripStaffFields<T extends object>(record: T): T {
  const copy: any = { ...record };
  for (const field of STAFF_ONLY_FIELDS) delete copy[field];
  return copy;
}

@Injectable()
export class ServiceRequestsService {
  constructor(
    private database: DatabaseService,
    private issueReports: IssueReportsService,
    private dispatch: DispatchService,
  ) {}

  /** A report can only be routed to the org's own Operations Coordinator
   * (or its B2B equivalent, Facility Manager) or Sustainability Officer —
   * the two roles an end user's report can reach, never an arbitrary user. */
  private assertValidRecipient(
    assignedToId: string | undefined,
    organizationId: string | null,
  ) {
    if (!assignedToId) return;
    const recipient = this.database.users.find(
      (x) => x.user_id === assignedToId,
    );
    if (!recipient)
      throw new NotFoundException(
        `Target users with id '${assignedToId}' not found`,
      );
    if (organizationId && recipient.organization_id !== organizationId)
      throw new BadRequestException(
        `User ${assignedToId} belongs to a different organisation than this service request`,
      );
    const allowedRoles = [
      "Operations Coordinator",
      "Facility Manager",
      "Sustainability Officer",
    ];
    if (!allowedRoles.includes(recipient.role))
      throw new BadRequestException(
        `Service requests can only be assigned to a Operations Coordinator or Sustainability Officer`,
      );
  }

  create(createDto: CreateServiceRequestDto) {
    if (createDto.reporter_id) {
      const exists = this.database.users.find(
        (x) => x.user_id === createDto.reporter_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target users with id '${createDto.reporter_id}' not found`,
        );
    }
    // A new request always starts open. Later statuses are set by the people
    // who work on it, through PATCH.
    if (createDto.status !== undefined && createDto.status !== "open")
      throw new BadRequestException(
        `A new service request must start as 'open'`,
      );

    const organizationId = currentOrgId() ?? createDto.organization_id ?? null;
    this.assertValidRecipient(createDto.assigned_to_id, organizationId);
    const generatedId = crypto.randomUUID();
    const newRecord = {
      service_request_id: generatedId,
      ...createDto,
      status: "open",
      organization_id: organizationId,
      // When it was filed, so the visitor's cards can show a date
      created_at: new Date().toISOString(),
    };
    this.database.serviceRequests.push(newRecord as any);
    return newRecord;
  }

  /** Campus Visitors (and their Department Head equivalent) only ever see their own reports. */
  findAll(userId?: string, role?: string) {
    const all = scopeToTenant(this.database.serviceRequests);
    if (role !== "Campus Visitor" && role !== "Department Head") return all.map(withoutFilePaths);
    return all
      .filter(
        (t) =>
          t.reporter_id === userId ||
          !!t.reporter_ids?.includes(userId) ||
          !!t.plus_one_ids?.includes(userId),
      )
      .map(stripStaffFields)
      .map(withoutFilePaths);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.serviceRequests.find(
      (item) => item.service_request_id === id,
    ));
    if (!record)
      throw new NotFoundException(`ServiceRequest with ID ${id} not found`);
    return withoutFilePaths(record);
  }

  put(id: string, putDto: PutServiceRequestDto) {
    const index = this.database.serviceRequests.findIndex(
      (item) => item.service_request_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.serviceRequests[index]))
      throw new NotFoundException(`Service Request with ID ${id} not found`);
    this.assertValidRecipient(
      putDto.assigned_to_id,
      this.database.serviceRequests[index].organization_id,
    );
    this.database.serviceRequests[index] = {
      service_request_id: id,
      ...putDto,
      // A replace still keeps the date the request was first filed
      created_at: (this.database.serviceRequests[index] as any).created_at,
    } as any;
    return this.database.serviceRequests[index];
  }
  update(id: string, updateDto: UpdateServiceRequestDto) {
    const index = this.database.serviceRequests.findIndex(
      (item) => item.service_request_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.serviceRequests[index]))
      throw new NotFoundException(`ServiceRequest with ID ${id} not found`);
    this.assertValidRecipient(
      updateDto.assigned_to_id,
      this.database.serviceRequests[index].organization_id,
    );
    // On a structured report, a priority sent here is the coordinator's
    // override: kept apart from the system's own level, which keeps updating.
    if (this.database.serviceRequests[index].item_id && updateDto.priority !== undefined) {
      const { priority, ...rest } = updateDto;
      this.issueReports.setPriorityOverride(
        this.database.serviceRequests[index],
        priority.toLowerCase() as Level,
      );
      updateDto = rest;
    }
    this.database.serviceRequests[index] = {
      ...this.database.serviceRequests[index],
      ...updateDto,
      organization_id: this.database.serviceRequests[index].organization_id,
    };
    // Closing a ticket by hand also closes its job, so no load or warnings are left behind.
    if (["closed", "resolved", "completed"].includes(String(updateDto.status ?? "").toLowerCase())) {
      this.dispatch.closeForTicket(this.database.serviceRequests[index]);
    }
    return this.database.serviceRequests[index];
  }

  /** Coordinator override of an issue's priority; null returns to the system's level. */
  setPriority(id: string, level: string | null | undefined) {
    const ticket = assertTenantOwns(
      this.database.serviceRequests.find((t) => t.service_request_id === id),
    );
    if (!ticket) throw new NotFoundException(`ServiceRequest with ID ${id} not found`);
    if (!ticket.item_id) throw new BadRequestException("Only reported issues have a system priority.");
    this.issueReports.setPriorityOverride(ticket, level ? (level.toLowerCase() as Level) : null);
    return ticket;
  }

  remove(id: string) {
    const index = this.database.serviceRequests.findIndex(
      (item) => item.service_request_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.serviceRequests[index]))
      throw new NotFoundException(`ServiceRequest with ID ${id} not found`);
    const removed = this.database.serviceRequests.splice(index, 1);
    return removed[0];
  }

  getWorkOrders(id: string) {
    return scopeToTenant(this.database.workOrders.filter(
      (item) => item.source_request_id === id,
    ));
  }
}
