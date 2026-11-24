import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DatabaseService,
  ExpenseBill,
  ExpenseBillStatus,
  ExpenseCategory,
  NotificationTargetType,
  UserRole,
  WorkOrderStatus,
} from "../../core/database/database.service";
import { assertTenantOwns, currentOrgId, scopeToTenant } from "../../core/tenancy/tenant-context";
import { pushNotifications, usersWithRole } from "../../core/utils/notify";
import { assertMove, MoveTable } from "../../core/utils/transitions";
import { CreateExpenseBillDto } from "./dto/create-expense-bill.dto";
import { UpdateExpenseBillDto } from "./dto/update-expense-bill.dto";
import { UpdateExpenseSettingsDto } from "./dto/update-expense-settings.dto";

const DEFAULT_AUTO_APPROVE_CAP = 1500;
const MAX_AUTO_APPROVED_PER_WO = 2;

const WORKFLOW: MoveTable[] = [
  {
    roles: [UserRole.FINANCIAL_ANALYST, UserRole.ECONOMIC_BUYER, UserRole.ORGANIZATION_ADMIN],
    moves: {
      [ExpenseBillStatus.SUBMITTED]: [ExpenseBillStatus.APPROVED, ExpenseBillStatus.REJECTED],
    },
  },
  {
    roles: [UserRole.TECHNICIAN, UserRole.ORGANIZATION_ADMIN],
    moves: {
      [ExpenseBillStatus.REJECTED]: [ExpenseBillStatus.SUBMITTED],
    },
  },
];

const ALLOWED_WO_STATUSES = new Set([
  WorkOrderStatus.INPROGRESS,
  WorkOrderStatus.REVIEW,
  WorkOrderStatus.CLOSED,
]);

@Injectable()
export class ExpenseBillsService {
  constructor(private database: DatabaseService) {}

  public getOrgCap(orgId: string | null): number {
    const org = this.database.organizations.find((o) => o.organization_id === orgId);
    return typeof org?.expense_auto_approve_cap === "number"
      ? org.expense_auto_approve_cap
      : DEFAULT_AUTO_APPROVE_CAP;
  }

  public getSettings(orgId: string | null) {
    const resolvedOrgId = currentOrgId() ?? orgId;
    return {
      auto_approve_cap: this.getOrgCap(resolvedOrgId),
      max_auto_approved_per_wo: MAX_AUTO_APPROVED_PER_WO,
    };
  }

  public updateSettings(dto: UpdateExpenseSettingsDto, orgId: string | null) {
    const resolvedOrgId = currentOrgId() ?? orgId;
    const org = this.database.organizations.find((o) => o.organization_id === resolvedOrgId);
    if (!org) {
      throw new NotFoundException("Organization not found.");
    }
    org.expense_auto_approve_cap = Number(dto.auto_approve_cap);
    return {
      auto_approve_cap: org.expense_auto_approve_cap,
      max_auto_approved_per_wo: MAX_AUTO_APPROVED_PER_WO,
    };
  }

  public create(dto: CreateExpenseBillDto, role?: string, userId?: string) {
    if (!userId) {
      throw new BadRequestException("User ID is required to create an expense bill.");
    }

    const wo = assertTenantOwns(
      this.database.workOrders.find((w) => w.work_order_id === dto.work_order_id),
    );
    if (!wo) {
      throw new NotFoundException("Work order not found.");
    }

    if (!ALLOWED_WO_STATUSES.has(wo.status)) {
      throw new BadRequestException(
        "Expense bills can only be uploaded for In Progress, Review, or Closed work orders.",
      );
    }

    if (role === UserRole.TECHNICIAN && wo.assigned_to_id !== userId) {
      throw new ForbiddenException(
        "You can only submit expense bills for work orders assigned to you.",
      );
    }

    const existingNonRejected = this.database.expenseBills.filter(
      (b) =>
        b.organization_id === wo.organization_id &&
        b.work_order_id === dto.work_order_id &&
        b.status !== ExpenseBillStatus.REJECTED,
    );
    const existingTotal = existingNonRejected.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    const existingAutoApprovedCount = existingNonRejected.filter((b) => b.auto_approved === true).length;
    const cap = this.getOrgCap(wo.organization_id);
    const newCumulativeTotal = existingTotal + Number(dto.amount);

    const qualifiesForAutoApprove =
      cap > 0 &&
      newCumulativeTotal <= cap &&
      existingAutoApprovedCount < MAX_AUTO_APPROVED_PER_WO;

    const now = new Date().toISOString();
    const bill: ExpenseBill = {
      expense_bill_id: crypto.randomUUID(),
      organization_id: wo.organization_id,
      work_order_id: dto.work_order_id,
      submitted_by_id: userId,
      title: dto.title,
      vendor: dto.vendor,
      category: dto.category,
      bill_date: dto.bill_date,
      bill_number: dto.bill_number ?? null,
      amount: Number(dto.amount),
      notes: dto.notes ?? null,
      attachments: [],
      status: qualifiesForAutoApprove ? ExpenseBillStatus.APPROVED : ExpenseBillStatus.SUBMITTED,
      auto_approved: qualifiesForAutoApprove,
      reviewed_by_id: null,
      reviewed_at: qualifiesForAutoApprove ? now : null,
      rejection_reason: null,
      created_at: now,
      updated_at: now,
      history: qualifiesForAutoApprove
        ? [
            {
              at: now,
              by: userId,
              role: role || UserRole.TECHNICIAN,
              action: "auto_approved",
              note: `Auto-approved under cumulative Work Order cap (₹${newCumulativeTotal} / ₹${cap})`,
            },
          ]
        : [
            {
              at: now,
              by: userId,
              role: role || UserRole.TECHNICIAN,
              action: "submitted",
            },
          ],
    };

    this.database.expenseBills.push(bill);

    const financeUserIds = usersWithRole(this.database, wo.organization_id, [
      UserRole.FINANCIAL_ANALYST,
      UserRole.ECONOMIC_BUYER,
    ]);

    pushNotifications(this.database, {
      organizationId: wo.organization_id,
      userIds: financeUserIds,
      targetType: NotificationTargetType.EXPENSE,
      targetId: bill.expense_bill_id,
      message: qualifiesForAutoApprove
        ? `Minor expense bill '${bill.title}' (₹${bill.amount}) was auto-approved under the ₹${cap} Work Order cap.`
        : `New expense bill '${bill.title}' (₹${bill.amount}) submitted for review.`,
    });

    return this.serialize(bill);
  }

  public findAll(
    role?: string,
    userId?: string,
    filters?: { status?: string; work_order_id?: string },
  ) {
    let list = scopeToTenant(this.database.expenseBills);

    if (role === UserRole.TECHNICIAN && userId) {
      list = list.filter((b) => b.submitted_by_id === userId);
    }

    if (filters?.status) {
      list = list.filter((b) => b.status === filters.status);
    }

    if (filters?.work_order_id) {
      list = list.filter((b) => b.work_order_id === filters.work_order_id);
    }

    const sorted = [...list].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );

    return sorted.map((b) => this.serialize(b));
  }

  public findOne(id: string, role?: string, userId?: string) {
    const bill = assertTenantOwns(
      this.database.expenseBills.find((b) => b.expense_bill_id === id),
    );
    if (!bill) {
      throw new NotFoundException("Expense bill not found.");
    }

    if (role === UserRole.TECHNICIAN && bill.submitted_by_id !== userId) {
      throw new ForbiddenException("You can only access your own expense bills.");
    }

    return this.serialize(bill);
  }

  public update(id: string, dto: UpdateExpenseBillDto, role?: string, userId?: string) {
    const bill = assertTenantOwns(
      this.database.expenseBills.find((b) => b.expense_bill_id === id),
    );
    if (!bill) {
      throw new NotFoundException("Expense bill not found.");
    }

    const isFinanceReviewer =
      role === UserRole.FINANCIAL_ANALYST ||
      role === UserRole.ECONOMIC_BUYER ||
      role === UserRole.ORGANIZATION_ADMIN;

    const isRevokingAutoApproval =
      bill.status === ExpenseBillStatus.APPROVED &&
      bill.auto_approved === true &&
      isFinanceReviewer &&
      dto.status === ExpenseBillStatus.REJECTED;

    if (bill.status === ExpenseBillStatus.APPROVED && !isRevokingAutoApproval) {
      throw new ForbiddenException(
        bill.auto_approved
          ? "Auto-approved bills can only be revoked by Finance or Organization Admin."
          : "Manually approved expense bills are locked and cannot be modified.",
      );
    }

    if (role === UserRole.TECHNICIAN && bill.submitted_by_id !== userId) {
      throw new ForbiddenException("You can only modify your own expense bills.");
    }

    const contentFieldsModified =
      dto.title !== undefined ||
      dto.vendor !== undefined ||
      dto.category !== undefined ||
      dto.bill_date !== undefined ||
      dto.bill_number !== undefined ||
      dto.amount !== undefined ||
      dto.notes !== undefined;

    if (contentFieldsModified) {
      const canEditContent =
        !isRevokingAutoApproval &&
        ((role === UserRole.TECHNICIAN && bill.submitted_by_id === userId) ||
          role === UserRole.ORGANIZATION_ADMIN);

      if (!canEditContent) {
        throw new ForbiddenException("Only the technician who submitted the bill or an Organization Admin can edit bill details.");
      }

      if (dto.title !== undefined) bill.title = dto.title;
      if (dto.vendor !== undefined) bill.vendor = dto.vendor;
      if (dto.category !== undefined) bill.category = dto.category;
      if (dto.bill_date !== undefined) bill.bill_date = dto.bill_date;
      if (dto.bill_number !== undefined) bill.bill_number = dto.bill_number;
      if (dto.amount !== undefined) bill.amount = Number(dto.amount);
      if (dto.notes !== undefined) bill.notes = dto.notes;
    }

    const now = new Date().toISOString();

    if (isRevokingAutoApproval) {
      const reason = dto.rejection_reason?.trim();
      if (!reason) {
        throw new BadRequestException("A rejection reason is required to revoke an auto-approved bill.");
      }
      bill.status = ExpenseBillStatus.REJECTED;
      bill.auto_approved = false;
      bill.reviewed_by_id = userId ?? null;
      bill.reviewed_at = now;
      bill.rejection_reason = reason;
      bill.history.push({
        at: now,
        by: userId ?? "system",
        role: role ?? "reviewer",
        action: "revoked",
        note: reason,
      });

      pushNotifications(this.database, {
        organizationId: bill.organization_id,
        userIds: [bill.submitted_by_id],
        targetType: NotificationTargetType.EXPENSE,
        targetId: bill.expense_bill_id,
        message: `Auto-approved expense bill '${bill.title}' was flagged and revoked by Finance: ${reason}`,
      });
    } else if (dto.status !== undefined && dto.status !== bill.status) {
      assertMove(WORKFLOW, role, bill.status, dto.status, "an expense bill");

      if (dto.status === ExpenseBillStatus.REJECTED) {
        const reason = dto.rejection_reason?.trim();
        if (!reason) {
          throw new BadRequestException("A rejection reason is required.");
        }
        bill.status = ExpenseBillStatus.REJECTED;
        bill.auto_approved = false;
        bill.reviewed_by_id = userId ?? null;
        bill.reviewed_at = now;
        bill.rejection_reason = reason;
        bill.history.push({
          at: now,
          by: userId ?? "system",
          role: role ?? "reviewer",
          action: "rejected",
          note: reason,
        });

        pushNotifications(this.database, {
          organizationId: bill.organization_id,
          userIds: [bill.submitted_by_id],
          targetType: NotificationTargetType.EXPENSE,
          targetId: bill.expense_bill_id,
          message: `Expense bill '${bill.title}' was rejected: ${reason}`,
        });
      } else if (dto.status === ExpenseBillStatus.APPROVED) {
        bill.status = ExpenseBillStatus.APPROVED;
        bill.auto_approved = false;
        bill.reviewed_by_id = userId ?? null;
        bill.reviewed_at = now;
        bill.rejection_reason = null;
        bill.history.push({
          at: now,
          by: userId ?? "system",
          role: role ?? "reviewer",
          action: "approved",
        });

        pushNotifications(this.database, {
          organizationId: bill.organization_id,
          userIds: [bill.submitted_by_id],
          targetType: NotificationTargetType.EXPENSE,
          targetId: bill.expense_bill_id,
          message: `Expense bill '${bill.title}' (₹${bill.amount}) was approved.`,
        });
      } else if (dto.status === ExpenseBillStatus.SUBMITTED && bill.status === ExpenseBillStatus.REJECTED) {
        bill.status = ExpenseBillStatus.SUBMITTED;
        bill.auto_approved = false;
        bill.rejection_reason = null;
        bill.reviewed_by_id = null;
        bill.reviewed_at = null;
        bill.history.push({
          at: now,
          by: userId ?? "system",
          role: role ?? UserRole.TECHNICIAN,
          action: "resubmitted",
        });

        const financeUserIds = usersWithRole(this.database, bill.organization_id, [
          UserRole.FINANCIAL_ANALYST,
          UserRole.ECONOMIC_BUYER,
        ]);

        pushNotifications(this.database, {
          organizationId: bill.organization_id,
          userIds: financeUserIds,
          targetType: NotificationTargetType.EXPENSE,
          targetId: bill.expense_bill_id,
          message: `Expense bill '${bill.title}' (₹${bill.amount}) was resubmitted for review.`,
        });
      }
    }

    bill.updated_at = now;
    return this.serialize(bill);
  }

  public attachFiles(
    id: string,
    files: Array<{ path: string; originalname: string; mimetype: string; size: number }>,
    role?: string,
    userId?: string,
  ) {
    const discardFiles = () => {
      for (const f of files) {
        try {
          if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
        } catch {
          // Ignore unlink errors during cleanup
        }
      }
    };

    const bill = assertTenantOwns(
      this.database.expenseBills.find((b) => b.expense_bill_id === id),
    );
    if (!bill) {
      discardFiles();
      throw new NotFoundException("Expense bill not found.");
    }

    if (role === UserRole.TECHNICIAN && bill.submitted_by_id !== userId) {
      discardFiles();
      throw new ForbiddenException("You can only attach files to your own expense bills.");
    }

    if (bill.status === ExpenseBillStatus.APPROVED && !bill.auto_approved) {
      discardFiles();
      throw new ForbiddenException("Cannot attach files to an approved expense bill.");
    }

    if (bill.attachments.length + files.length > 5) {
      discardFiles();
      throw new BadRequestException("Maximum 5 attachments allowed per expense bill.");
    }

    const now = new Date().toISOString();
    for (const f of files) {
      bill.attachments.push({
        filename: path.basename(f.path),
        original_name: f.originalname,
        mime_type: f.mimetype,
        size: f.size,
        uploaded_at: now,
        disk_path: f.path,
      });
    }

    bill.updated_at = now;
    return this.serialize(bill);
  }

  public removeAttachment(id: string, filename: string, role?: string, userId?: string) {
    const bill = assertTenantOwns(
      this.database.expenseBills.find((b) => b.expense_bill_id === id),
    );
    if (!bill) {
      throw new NotFoundException("Expense bill not found.");
    }

    if (role === UserRole.TECHNICIAN && bill.submitted_by_id !== userId) {
      throw new ForbiddenException("You can only modify attachments on your own expense bills.");
    }

    if (bill.status === ExpenseBillStatus.APPROVED) {
      throw new ForbiddenException("Cannot remove attachments from an approved expense bill.");
    }

    const index = bill.attachments.findIndex((a) => a.filename === filename);
    if (index === -1) {
      throw new NotFoundException("Attachment not found on this expense bill.");
    }

    const [att] = bill.attachments.splice(index, 1);
    try {
      if (att.disk_path && fs.existsSync(att.disk_path)) {
        fs.unlinkSync(att.disk_path);
      }
    } catch {
      // Ignore disk error on delete
    }

    bill.updated_at = new Date().toISOString();
    return this.serialize(bill);
  }

  public getAttachmentPath(id: string, filename: string, role?: string, userId?: string) {
    const bill = assertTenantOwns(
      this.database.expenseBills.find((b) => b.expense_bill_id === id),
    );
    if (!bill) {
      throw new NotFoundException("Expense bill not found.");
    }

    if (role === UserRole.TECHNICIAN && bill.submitted_by_id !== userId) {
      throw new ForbiddenException("You can only access attachments on your own expense bills.");
    }

    const att = bill.attachments.find((a) => a.filename === filename);
    if (!att) {
      throw new NotFoundException("Attachment not found.");
    }

    if (!fs.existsSync(att.disk_path)) {
      throw new NotFoundException("Attachment file not found on disk.");
    }

    return {
      path: att.disk_path,
      originalName: att.original_name,
      mimeType: att.mime_type,
    };
  }

  public remove(id: string, role?: string, userId?: string) {
    const bill = assertTenantOwns(
      this.database.expenseBills.find((b) => b.expense_bill_id === id),
    );
    if (!bill) {
      throw new NotFoundException("Expense bill not found.");
    }
    const index = this.database.expenseBills.indexOf(bill);

    if (role === UserRole.TECHNICIAN) {
      if (bill.submitted_by_id !== userId || bill.status === ExpenseBillStatus.APPROVED) {
        throw new ForbiddenException(
          "Technicians can only delete their own non-approved expense bills.",
        );
      }
    } else if (role !== UserRole.ORGANIZATION_ADMIN && role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("You do not have permission to delete this expense bill.");
    }

    for (const att of bill.attachments) {
      try {
        if (att.disk_path && fs.existsSync(att.disk_path)) {
          fs.unlinkSync(att.disk_path);
        }
      } catch {
        // Ignore file delete errors
      }
    }

    const [removed] = this.database.expenseBills.splice(index, 1);
    return this.serialize(removed);
  }

  public serialize(bill: ExpenseBill) {
    const wo = this.database.workOrders.find((w) => w.work_order_id === bill.work_order_id);
    const submitter = this.database.users.find((u) => u.user_id === bill.submitted_by_id);
    const reviewer = bill.reviewed_by_id
      ? this.database.users.find((u) => u.user_id === bill.reviewed_by_id)
      : null;

    const estimatedTotal: number | null =
      typeof wo?.details?.estimate?.total === "number" ? wo.details.estimate.total : null;

    const nonRejected = this.database.expenseBills.filter(
      (b) =>
        b.organization_id === bill.organization_id &&
        b.work_order_id === bill.work_order_id &&
        b.status !== ExpenseBillStatus.REJECTED,
    );

    const workOrderBilledTotal = nonRejected.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    const varianceAmount =
      estimatedTotal !== null ? workOrderBilledTotal - estimatedTotal : null;
    const overEstimate =
      estimatedTotal !== null && workOrderBilledTotal > estimatedTotal;

    const cap = this.getOrgCap(bill.organization_id);
    const autoApprovedCount = nonRejected.filter((b) => b.auto_approved === true).length;

    const safeAttachments = bill.attachments.map((a) => ({
      filename: a.filename,
      original_name: a.original_name,
      mime_type: a.mime_type,
      size: a.size,
      uploaded_at: a.uploaded_at,
      url: `/expense-bills/${bill.expense_bill_id}/attachments/${a.filename}`,
    }));

    return {
      expense_bill_id: bill.expense_bill_id,
      organization_id: bill.organization_id,
      work_order_id: bill.work_order_id,
      submitted_by_id: bill.submitted_by_id,
      title: bill.title,
      vendor: bill.vendor,
      category: bill.category,
      bill_date: bill.bill_date,
      bill_number: bill.bill_number,
      amount: bill.amount,
      notes: bill.notes,
      status: bill.status,
      auto_approved: bill.auto_approved ?? false,
      reviewed_by_id: bill.reviewed_by_id,
      reviewed_at: bill.reviewed_at,
      rejection_reason: bill.rejection_reason,
      created_at: bill.created_at,
      updated_at: bill.updated_at,
      history: bill.history,
      attachments: safeAttachments,
      work_order_title: wo?.title ?? "Unknown Work Order",
      work_order_status: wo?.status ?? null,
      submitted_by_name: submitter?.name ?? "Unknown",
      reviewed_by_name: reviewer?.name ?? null,
      variance: {
        has_estimate: estimatedTotal !== null,
        estimated_total: estimatedTotal,
        estimated_materials: wo?.details?.estimate?.materials ?? null,
        estimated_labor: wo?.details?.estimate?.labor ?? null,
        work_order_billed_total: workOrderBilledTotal,
        work_order_bill_count: nonRejected.length,
        variance_amount: varianceAmount,
        over_estimate: overEstimate,
        auto_approve_cap: cap,
        auto_approved_count: autoApprovedCount,
        max_auto_approved_per_wo: MAX_AUTO_APPROVED_PER_WO,
        exceeds_auto_approve_cap: cap > 0 && workOrderBilledTotal > cap,
        split_bill_watch: nonRejected.length >= 3,
        receipt_required: !bill.auto_approved,
      },
    };
  }
}
