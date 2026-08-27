import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiConsumes, ApiBody } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put, UseInterceptors, UploadedFile, UseFilters, BadRequestException, Res } from "@nestjs/common";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { documentUploadConfig } from "../../core/middleware/file-upload.middleware";
import { MulterExceptionFilter } from "../../core/filters/multer-exception.filter";
import { InvoicesService } from "./invoices.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { PutInvoiceDto } from "./dto/put-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { Roles } from "../../core/decorators/roles.decorator";
import { assertFileSignature } from "../../core/utils/file-signature";

@ApiTags("invoices")
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @ApiOperation({ summary: "Create Invoice", description: "Creates a new invoice for a department. Financial Analyst and System Administrator can submit invoices." })
  @ApiResponse({ status: 201, description: "Invoice created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Financial Analyst", "System Administrator")
  create(@Body() createDto: CreateInvoiceDto) {
    return this.invoicesService.create(createDto);
  }
  @Post(":id/document")
@UseFilters(MulterExceptionFilter)
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      file: { type: 'string', format: 'binary' },
    },
  },
})
  @ApiOperation({ summary: "Attach Invoice Document", description: "Uploads a scanned PDF and attaches it to an existing invoice so the approver can review it. Financial Analyst and System Administrator can attach documents. Send a multipart/form-data POST request with the PDF under the 'file' field." })
  @ApiResponse({ status: 201, description: "Document attached successfully." })
  @ApiResponse({ status: 400, description: "File missing, wrong type, or over the size limit." })
  @ApiResponse({ status: 404, description: "Invoice with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Financial Analyst", "System Administrator")
  @UseInterceptors(FileInterceptor("file", documentUploadConfig))
  uploadDocument(@Param("id") id: string, @UploadedFile() file: Express.Multer.File) {
    // Multer leaves `file` undefined when the request carries no file at all.
    // Without this guard the service dereferences file.path and the caller
    // gets a 500, contradicting the documented 400 above.
    if (!file) {
      throw new BadRequestException("No file was uploaded under the 'file' field");
    }
    // Extension and MIME type are client-supplied and forgeable. Check the
    // actual leading bytes before the file is attached to a financial record.
    assertFileSignature(file, "pdf");
    return this.invoicesService.attachDocument(id, file);
  }

  @Get(":id/document")
  @ApiOperation({ summary: "Download Invoice Document", description: "Streams back the PDF previously attached to this invoice. The file path is read from the invoice record, never from the URL, and tenant ownership is checked before the file is served." })
  @ApiResponse({ status: 200, description: "PDF file streamed." })
  @ApiResponse({ status: 404, description: "Invoice not found, or it has no document attached." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Financial Analyst", "System Administrator")
  downloadDocument(@Param("id") id: string, @Res() res: Response) {
    const { path, filename } = this.invoicesService.getDocument(id);
    // res.download sets Content-Disposition so the browser saves it under the
    // name the uploader used, not the randomised name it has on disk.
    return res.download(path, filename);
  }

  @Get()
  @ApiOperation({ summary: "List All Invoices", description: "Retrieves all invoices. Financial Analyst and System Administrator can view the invoice directory." })
  @ApiResponse({ status: 200, description: "Array of invoice records returned." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Financial Analyst", "System Administrator")
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Invoice by ID", description: "Retrieves a single invoice by UUID. Financial Analyst and System Administrator can look up invoices." })
  @ApiResponse({ status: 200, description: "Invoice record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Financial Analyst", "System Administrator")
  findOne(@Param("id") id: string) {
    return this.invoicesService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Invoice", description: "Completely replaces an invoice record. Only System Administrator can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutInvoiceDto) {
    return this.invoicesService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Invoice", description: "Partially updates an invoice (e.g., changing status to approved, setting approved_by_id). Financial Analyst and System Administrator can update." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Financial Analyst", "System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Invoice", description: "Permanently removes an invoice. Only System Administrator can delete." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.invoicesService.remove(id);
  }
}
