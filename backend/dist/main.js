"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const transform_interceptor_1 = require("./core/interceptors/transform.interceptor");
const roles_guard_1 = require("./core/guards/roles.guard");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const reflector = app.get(core_1.Reflector);
    app.useGlobalGuards(new roles_guard_1.RolesGuard(reflector));
    app.useGlobalInterceptors(new transform_interceptor_1.TransformInterceptor());
    app.enableCors({
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Accept', 'x-role'],
    });
    const config = new swagger_1.DocumentBuilder()
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
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('api/docs', app, document);
    const fs = require('fs');
    if (!fs.existsSync('./docs'))
        fs.mkdirSync('./docs');
    fs.writeFileSync('./docs/swagger.json', JSON.stringify(document, null, 2));
    const port = process.env.PORT || 3000;
    await app.listen(port);
}
bootstrap();
//# sourceMappingURL=main.js.map