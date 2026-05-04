import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SustainabilityReportsService } from './sustainability-reports.service';
import { CreateSustainabilityReportDto } from './dto/create-sustainability-report.dto';
import { UpdateSustainabilityReportDto } from './dto/update-sustainability-report.dto';
import { Roles } from '../../core/decorators/roles.decorator';

@ApiTags('sustainability-reports')
@Controller('sustainability-reports')
export class SustainabilityReportsController {
  constructor(private readonly sustainabilityReportsService: SustainabilityReportsService) {}

  @Post()
  @ApiOperation({ summary: 'Create record' })
  @ApiResponse({ status: 201, description: 'Successful response' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  @Roles('Sustainability Officer', 'System Administrator')
  create(@Body() createDto: CreateSustainabilityReportDto) {
    return this.sustainabilityReportsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve record(s)' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  findAll() {
    return this.sustainabilityReportsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve record(s)' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  findOne(@Param('id') id: string) {
    return this.sustainabilityReportsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update record' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  @Roles('Sustainability Officer', 'System Administrator')
  update(@Param('id') id: string, @Body() updateDto: UpdateSustainabilityReportDto) {
    return this.sustainabilityReportsService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete record' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  @Roles('System Administrator')
  remove(@Param('id') id: string) {
    return this.sustainabilityReportsService.remove(id);
  }
}
