import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';
import { RolesGuard } from './core/guards/roles.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');

  // 1. ValidationPipe globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 2. RolesGuard globally
  const reflector = app.get(Reflector);
  app.useGlobalGuards(new RolesGuard(reflector));

  // 3. TransformInterceptor & LoggingInterceptor globally
  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new LoggingInterceptor(),
  );

  // 4. CORS enabled for all origins
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'x-role'],
  });

  // 5. Swagger setup at /api/docs
  const config = new DocumentBuilder()
    .setTitle('EnerTrack API')
    .setDescription('Backend API for EnerTrack — Facility Management, Sustainability & Finance Platform')
    .setVersion('1.0')
    .addTag('users', 'User management and role assignment')
    .addTag('notifications', 'Notification delivery and read tracking')
    .addTag('campus', 'Campus-level location management')
    .addTag('buildings', 'Building management within campuses')
    .addTag('departments', 'Department management within buildings')
    .addTag('meters', 'IoT meter configuration and tracking')
    .addTag('meter-readings', 'Sensor/meter reading ingestion')
    .addTag('wastage-reports', 'Wastage report submission and tracking')
    .addTag('alerts', 'Maintenance alert lifecycle and chat threads')
    .addTag('faults', 'Fault tracking and technician assignment')
    .addTag('service-requests', 'Campus visitor and staff service requests')
    .addTag('work-orders', 'Work order creation and progress tracking')
    .addTag('energy-costs', 'Energy cost tracking per building/department')
    .addTag('invoices', 'Invoice management and approval workflow')
    .addTag('financial-reports', 'Financial report generation and retrieval')
    .addTag('sustainability-metrics', 'Platform-wide sustainability KPI tracking')
    .addTag('initiatives', 'Sustainability initiative proposals and lifecycle')
    .addTag('activity-logs', 'System-wide audit log')
    .addTag('sustainability-reports', 'Sustainability report generation and archiving')
    .addApiKey({ type: 'apiKey', name: 'x-role', in: 'header' }, 'x-role')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  
  // Inject preset examples from Universal DB (DatabaseService)
  const { DatabaseService } = require('./core/database/database.service');
  const db = new DatabaseService();
  const examples = {
    CreateUserDto: db.users[0], UpdateUserDto: db.users[0],
    CreateNotificationDto: db.notifications[0], UpdateNotificationDto: db.notifications[0],
    CreateCampusDto: db.campus[0], UpdateCampusDto: db.campus[0],
    CreateBuildingDto: db.buildings[0], UpdateBuildingDto: db.buildings[0],
    CreateDepartmentDto: db.departments[0], UpdateDepartmentDto: db.departments[0],
    CreateMeterDto: db.meters[0], UpdateMeterDto: db.meters[0],
    CreateMeterReadingDto: db.meterReadings[0], UpdateMeterReadingDto: db.meterReadings[0],
    CreateWastageReportDto: db.wastageReports[0], UpdateWastageReportDto: db.wastageReports[0],
    CreateAlertDto: db.alerts[0], UpdateAlertDto: db.alerts[0],
    CreateFaultDto: db.faults[0], UpdateFaultDto: db.faults[0],
    CreateServiceRequestDto: db.serviceRequests[0], UpdateServiceRequestDto: db.serviceRequests[0],
    CreateWorkOrderDto: db.workOrders[0], UpdateWorkOrderDto: db.workOrders[0],
    CreateEnergyCostDto: db.energyCosts[0], UpdateEnergyCostDto: db.energyCosts[0],
    CreateInvoiceDto: db.invoices[0], UpdateInvoiceDto: db.invoices[0],
    CreateFinancialReportDto: db.financialReports[0], UpdateFinancialReportDto: db.financialReports[0],
    CreateSustainabilityMetricDto: db.sustainabilityMetrics[0], UpdateSustainabilityMetricDto: db.sustainabilityMetrics[0],
    CreateInitiativeDto: db.initiatives[0], UpdateInitiativeDto: db.initiatives[0],
    CreateActivityLogDto: db.activityLogs[0], UpdateActivityLogDto: db.activityLogs[0],
    CreateSustainabilityReportDto: db.sustainabilityReports[0], UpdateSustainabilityReportDto: db.sustainabilityReports[0]
  };

  if (document.components && document.components.schemas) {
    const keysToRemove = [
      'user_id', 'notification_id', 'campus_id', 'building_id', 'department_id',
      'meter_id', 'reading_id', 'wastage_report_id', 'alert_id', 'fault_id',
      'service_request_id', 'work_order_id', 'energy_cost_id', 'invoice_id',
      'financial_report_id', 'sustainability_metric_id', 'initiative_id',
      'activity_log_id', 'report_id'
    ];
    
    for (const [schemaName, schema] of Object.entries(document.components.schemas)) {
      if (examples[schemaName]) {
        const exampleClone = { ...examples[schemaName] };
        
        // Remove the primary key based on the schema (or just remove it if it exists and isn't a foreign key)
        // Since we don't want to remove foreign keys (like building_id in CreateDepartmentDto),
        // we'll selectively remove the ID that corresponds to the schema.
        const typeMatch = schemaName.match(/Create(.*)Dto|Update(.*)Dto/);
        if (typeMatch) {
          const entityName = typeMatch[1] || typeMatch[2]; // e.g. 'User', 'Notification'
          // Convert entity name to snake_case for the ID property
          const snakeCaseEntity = entityName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
          const expectedIdField = `${snakeCaseEntity}_id`;
          
          if (exampleClone[expectedIdField]) {
             delete exampleClone[expectedIdField];
          }
          // Special case overrides:
          if (entityName === 'MeterReading') delete exampleClone['reading_id'];
          if (entityName === 'SustainabilityReport') delete exampleClone['report_id'];
        }
        
        (schema as any).example = exampleClone;
      }
    }
  }

  SwaggerModule.setup('api/docs', app, document);

  const fs = require('fs');
  if (!fs.existsSync('./docs')) fs.mkdirSync('./docs');
  fs.writeFileSync('./docs/swagger.json', JSON.stringify(document, null, 2));

  // 6. Listen on port 3000 (or process.env.PORT)
  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap();
