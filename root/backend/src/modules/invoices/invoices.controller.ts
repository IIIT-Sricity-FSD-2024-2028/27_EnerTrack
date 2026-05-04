import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { PutInvoiceDto } from "./dto/put-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { Roles } from "../../core/decorators/roles.decorator";

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
