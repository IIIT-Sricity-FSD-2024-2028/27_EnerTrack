import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { Roles } from '../../core/decorators/roles.decorator';
import { AddMessageDto } from './dto/add-message.dto';

@ApiTags('alerts')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @ApiOperation({ summary: 'Create record' })
  @ApiResponse({ status: 201, description: 'Successful response' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  @Roles('System Administrator', 'Technician')
  create(@Body() createDto: CreateAlertDto) {
    return this.alertsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve record(s)' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  findAll() {
    return this.alertsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve record(s)' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  findOne(@Param('id') id: string) {
    return this.alertsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update record' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  @Roles('System Administrator', 'Technician')
  update(@Param('id') id: string, @Body() updateDto: UpdateAlertDto) {
    return this.alertsService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete record' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  @Roles('System Administrator')
  remove(@Param('id') id: string) {
    return this.alertsService.remove(id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Create record' })
  @ApiResponse({ status: 201, description: 'Successful response' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  @Roles('System Administrator', 'Technician')
  addMessage(@Param('id') id: string, @Body() messageDto: AddMessageDto) {
    // implemented logic for adding message
    return this.alertsService.addMessage(id, messageDto);
  }

  @Get(':id/faults')
  @ApiOperation({ summary: 'Retrieve record(s)' })
  @ApiResponse({ status: 200, description: 'Successful response' })
  @ApiResponse({ status: 403, description: 'Forbidden (RBAC)' })
  @ApiHeader({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false })
  getFaults(@Param('id') id: string) {
    return this.alertsService.getFaults(id);
  }
}
