import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { EnergyCostsService } from './energy-costs.service';
import { CreateEnergyCostDto } from './dto/create-energy-cost.dto';
import { UpdateEnergyCostDto } from './dto/update-energy-cost.dto';
import { Roles } from '../../core/decorators/roles.decorator';

@ApiTags('energy-costs')
@Controller('energy-costs')
export class EnergyCostsController {
  constructor(private readonly energyCostsService: EnergyCostsService) {}

  @Post()
  @ApiOperation({ summary: 'Create record' })
  @ApiResponse({ status: 201, description: 'Successful response' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  @Roles('Financial Analyst', 'System Administrator')
  create(@Body() createDto: CreateEnergyCostDto) {
    return this.energyCostsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve record(s)' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  findAll() {
    return this.energyCostsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve record(s)' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  findOne(@Param('id') id: string) {
    return this.energyCostsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update record' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  @Roles('Financial Analyst', 'System Administrator')
  update(@Param('id') id: string, @Body() updateDto: UpdateEnergyCostDto) {
    return this.energyCostsService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete record' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  @Roles('System Administrator')
  remove(@Param('id') id: string) {
    return this.energyCostsService.remove(id);
  }

  @Get('by-period/:period')
  @ApiOperation({ summary: 'Retrieve record(s)' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  getByPeriod(@Param('period') period: string) {
    return this.energyCostsService.getByPeriod(period);
  }
}
