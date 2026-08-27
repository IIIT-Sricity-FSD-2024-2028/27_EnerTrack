import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiConsumes, ApiBody } from "@nestjs/swagger";
import { Controller, Get, Post, Body, Patch, Param, Delete, Put, UseInterceptors, UploadedFiles, UseFilters, BadRequestException } from "@nestjs/common";
import { WastageReportsService } from "./wastage-reports.service";
import { CreateWastageReportDto } from "./dto/create-wastage-report.dto";
import { PutWastageReportDto } from "./dto/put-wastage-report.dto";
import { UpdateWastageReportDto } from "./dto/update-wastage-report.dto";
import { Roles } from "../../core/decorators/roles.decorator";
import { assertFileSignatures } from "../../core/utils/file-signature";
import { FilesInterceptor } from "@nestjs/platform-express";
import { photoUploadConfig } from "../../core/middleware/file-upload.middleware";
import { MulterExceptionFilter } from "../../core/filters/multer-exception.filter";

@ApiTags("wastage-reports")
@Controller("wastage-reports")
export class WastageReportsController {
  constructor(private readonly wastageReportsService: WastageReportsService) {}

  @Post()
  @ApiOperation({ summary: "Create Wastage Report", description: "Submits a new wastage report. Any authenticated user (including Campus Visitor) can report wastage. Send a POST with a CreateWastageReportDto JSON body." })
  @ApiResponse({ status: 201, description: "Wastage report created successfully." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  create(@Body() createDto: CreateWastageReportDto) {
    return this.wastageReportsService.create(createDto);
  }
  @Post(":id/photos")
@UseFilters(MulterExceptionFilter)
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
      },
    },
  },
})
  @ApiOperation({ summary: "Attach Wastage Report Photos", description: "Uploads up to 4 photos as evidence for a wastage report. Any authenticated user can attach photos. Send a multipart/form-data POST request with images under the 'files' field." })
  @ApiResponse({ status: 201, description: "Photos attached successfully." })
  @ApiResponse({ status: 400, description: "File missing, wrong type, or over the size limit." })
  @ApiResponse({ status: 404, description: "Wastage report with the given ID not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  @UseInterceptors(FilesInterceptor("files", 4, photoUploadConfig))
  uploadPhotos(@Param("id") id: string, @UploadedFiles() files: Express.Multer.File[]) {
    // Multer leaves `files` undefined (or empty) when the request carries no
    // files at all. Without this guard the service calls files.map and the
    // caller gets a 500, contradicting the documented 400 above.
    if (!files || files.length === 0) {
      throw new BadRequestException("No files were uploaded under the 'files' field");
    }
    // Every file must genuinely be a JPEG or PNG, not just named like one.
    assertFileSignatures(files, "image");
    return this.wastageReportsService.attachPhotos(id, files);
  }
  @Get()
  @ApiOperation({ summary: "List All Wastage Reports", description: "Retrieves all wastage reports. Any authenticated user can view them (the frontend filters by reporter)." })
  @ApiResponse({ status: 200, description: "Array of wastage report records returned." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  findAll() {
    return this.wastageReportsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Wastage Report by ID", description: "Retrieves a single wastage report by UUID. Any authenticated user can look up reports." })
  @ApiResponse({ status: 200, description: "Wastage report record returned." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden (RBAC)" })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator", "Financial Analyst", "Technician", "Sustainability Officer", "Campus Visitor")
  findOne(@Param("id") id: string) {
    return this.wastageReportsService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Replace Wastage Report", description: "Completely replaces an existing wastage report. Only the System Administrator can perform full replacements." })
  @ApiResponse({ status: 200, description: "Replaced successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  put(@Param("id") id: string, @Body() putDto: PutWastageReportDto) {
    return this.wastageReportsService.put(id, putDto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update Wastage Report", description: "Partially updates a wastage report (e.g., status). The Sustainability Officer and System Administrator can update reports." })
  @ApiResponse({ status: 200, description: "Updated successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("Sustainability Officer", "System Administrator")
  update(@Param("id") id: string, @Body() updateDto: UpdateWastageReportDto) {
    return this.wastageReportsService.update(id, updateDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete Wastage Report", description: "Permanently removes a wastage report. Only the System Administrator can delete." })
  @ApiResponse({ status: 200, description: "Deleted successfully." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 403, description: "Forbidden." })
  @ApiHeader({ name: "x-role", description: "User role for RBAC.", required: false })
  @Roles("System Administrator")
  remove(@Param("id") id: string) {
    return this.wastageReportsService.remove(id);
  }
}
