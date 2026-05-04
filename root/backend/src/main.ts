import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TransformInterceptor } from './core/interceptors/transform.interceptor';
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

  // 3. TransformInterceptor globally
  app.useGlobalInterceptors(new TransformInterceptor());

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
  SwaggerModule.setup('api/docs', app, document);

  const fs = require('fs');
  if (!fs.existsSync('./docs')) fs.mkdirSync('./docs');
  fs.writeFileSync('./docs/swagger.json', JSON.stringify(document, null, 2));

  // 6. Listen on port 3000 (or process.env.PORT)
  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap();
