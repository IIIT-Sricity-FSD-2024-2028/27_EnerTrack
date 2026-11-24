import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFiles,
  UseFilters,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { Roles } from "../../core/decorators/roles.decorator";
import { MulterExceptionFilter } from "../../core/filters/multer-exception.filter";
import { billUploadConfig } from "../../core/middleware/file-upload.middleware";
import { assertFileSignatures } from "../../core/utils/file-signature";
import { CreateExpenseBillDto } from "./dto/create-expense-bill.dto";
import { UpdateExpenseBillDto } from "./dto/update-expense-bill.dto";
import { UpdateExpenseSettingsDto } from "./dto/update-expense-settings.dto";
import { ExpenseBillsService } from "./expense-bills.service";

@ApiTags("expense-bills")
@Controller("expense-bills")
export class ExpenseBillsController {
  constructor(private readonly expenseBillsService: ExpenseBillsService) {}

  @Post()
  @ApiOperation({
    summary: "Create Expense Bill",
    description: "Submits a new expense bill linked to an inprogress, review, or closed work order.",
  })
  @ApiResponse({ status: 201, description: "Expense bill created successfully." })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC." })
  @ApiHeader({ name: "x-user-id", description: "User ID." })
  @Roles("Technician", "Organization Admin")
  create(
    @Body() createDto: CreateExpenseBillDto,
    @Headers("x-role") role?: string,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.expenseBillsService.create(createDto, role, userId);
  }

  @Post(":id/attachments")
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(FilesInterceptor("files", 5, billUploadConfig))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        files: {
          type: "array",
          items: { type: "string", format: "binary" },
        },
      },
    },
  })
  @ApiOperation({
    summary: "Upload Expense Bill Receipts",
    description: "Uploads up to 5 receipts/invoices (.pdf, .jpg, .jpeg, .png up to 10MB each) for an expense bill.",
  })
  @ApiResponse({ status: 201, description: "Files attached successfully." })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC." })
  @ApiHeader({ name: "x-user-id", description: "User ID." })
  @Roles("Technician", "Organization Admin")
  uploadAttachments(
    @Param("id") id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Headers("x-role") role?: string,
    @Headers("x-user-id") userId?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("At least one file must be provided.");
    }
    assertFileSignatures(files, "pdf_or_image");
    return this.expenseBillsService.attachFiles(id, files, role, userId);
  }

  @Get(":id/attachments/:filename")
  @ApiOperation({
    summary: "Download or preview Expense Bill Attachment",
    description: "Streams an expense bill attachment file.",
  })
  @ApiResponse({ status: 200, description: "File content." })
  @ApiResponse({ status: 404, description: "Attachment not found." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC." })
  @ApiHeader({ name: "x-user-id", description: "User ID." })
  @Roles("Technician", "Financial Analyst", "Organization Admin")
  getAttachment(
    @Param("id") id: string,
    @Param("filename") filename: string,
    @Headers("x-role") role: string | undefined,
    @Headers("x-user-id") userId: string | undefined,
    @Res() res: Response,
  ) {
    const fileInfo = this.expenseBillsService.getAttachmentPath(id, filename, role, userId);
    res.setHeader("Content-Type", fileInfo.mimeType);
    return res.sendFile(fileInfo.path);
  }

  @Delete(":id/attachments/:filename")
  @ApiOperation({
    summary: "Delete Expense Bill Attachment",
    description: "Removes an attachment from a non-approved expense bill.",
  })
  @ApiResponse({ status: 200, description: "Attachment removed successfully." })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC." })
  @ApiHeader({ name: "x-user-id", description: "User ID." })
  @Roles("Technician", "Organization Admin")
  removeAttachment(
    @Param("id") id: string,
    @Param("filename") filename: string,
    @Headers("x-role") role?: string,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.expenseBillsService.removeAttachment(id, filename, role, userId);
  }

  @Get()
  @ApiOperation({
    summary: "List Expense Bills",
    description: "Returns expense bills scoped to the organization. Technicians see only their submitted bills.",
  })
  @ApiResponse({ status: 200, description: "List of expense bills." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC." })
  @ApiHeader({ name: "x-user-id", description: "User ID." })
  @Roles("Technician", "Financial Analyst", "Organization Admin")
  findAll(
    @Headers("x-role") role?: string,
    @Headers("x-user-id") userId?: string,
    @Query("status") status?: string,
    @Query("work_order_id") workOrderId?: string,
  ) {
    return this.expenseBillsService.findAll(role, userId, {
      status,
      work_order_id: workOrderId,
    });
  }

  @Get("settings")
  @ApiOperation({
    summary: "Get Expense Auto-Approve Settings",
    description: "Returns the organization's cumulative per-Work-Order minor expense cap and max auto-approvals per WO.",
  })
  @ApiResponse({ status: 200, description: "Expense settings." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC." })
  @Roles("Technician", "Financial Analyst", "Organization Admin")
  getSettings() {
    return this.expenseBillsService.getSettings(null);
  }

  @Patch("settings")
  @ApiOperation({
    summary: "Update Expense Auto-Approve Cap",
    description: "Updates the organization's cumulative per-Work-Order auto-approve cap (set 0 to disable auto-approval).",
  })
  @ApiResponse({ status: 200, description: "Expense settings updated." })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC." })
  @Roles("Financial Analyst", "Organization Admin")
  updateSettings(@Body() dto: UpdateExpenseSettingsDto) {
    return this.expenseBillsService.updateSettings(dto, null);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get Expense Bill Details",
    description: "Returns an enriched expense bill with variance calculations.",
  })
  @ApiResponse({ status: 200, description: "Expense bill details." })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC." })
  @ApiHeader({ name: "x-user-id", description: "User ID." })
  @Roles("Technician", "Financial Analyst", "Organization Admin")
  findOne(
    @Param("id") id: string,
    @Headers("x-role") role?: string,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.expenseBillsService.findOne(id, role, userId);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update / Review Expense Bill",
    description: "Edit bill details, resubmit rejected bill, or approve/reject bill.",
  })
  @ApiResponse({ status: 200, description: "Expense bill updated successfully." })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC." })
  @ApiHeader({ name: "x-user-id", description: "User ID." })
  @Roles("Technician", "Financial Analyst", "Organization Admin")
  update(
    @Param("id") id: string,
    @Body() updateDto: UpdateExpenseBillDto,
    @Headers("x-role") role?: string,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.expenseBillsService.update(id, updateDto, role, userId);
  }

  @Delete(":id")
  @ApiOperation({
    summary: "Delete Expense Bill",
    description: "Deletes a non-approved expense bill.",
  })
  @ApiResponse({ status: 200, description: "Expense bill deleted successfully." })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Not found" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC." })
  @ApiHeader({ name: "x-user-id", description: "User ID." })
  @Roles("Technician", "Organization Admin")
  remove(
    @Param("id") id: string,
    @Headers("x-role") role?: string,
    @Headers("x-user-id") userId?: string,
  ) {
    return this.expenseBillsService.remove(id, role, userId);
  }
}
