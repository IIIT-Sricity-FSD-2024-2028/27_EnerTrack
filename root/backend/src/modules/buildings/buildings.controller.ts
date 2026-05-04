import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { UpdateBuildingDto } from './dto/update-building.dto';
import { Roles } from '../../core/decorators/roles.decorator';

@ApiTags('buildings')
@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create record' })
  @ApiResponse({ status: 201, description: 'Successful response' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  @Roles('System Administrator')
  create(@Body() createDto: CreateBuildingDto) {
    return this.buildingsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve record(s)' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  findAll() {
    return this.buildingsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve record(s)' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  findOne(@Param('id') id: string) {
    return this.buildingsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update record' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  @Roles('System Administrator')
  update(@Param('id') id: string, @Body() updateDto: UpdateBuildingDto) {
    return this.buildingsService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete record' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  @Roles('System Administrator')
  remove(@Param('id') id: string) {
    return this.buildingsService.remove(id);
  }

  @Get(':id/departments')
  @ApiOperation({ summary: 'Retrieve record(s)' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  getDepartments(@Param('id') id: string) {
    return this.buildingsService.getDepartments(id);
  }

  @Get(':id/meters')
  @ApiOperation({ summary: 'Retrieve record(s)' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  getMeters(@Param('id') id: string) {
    return this.buildingsService.getMeters(id);
  }
}
