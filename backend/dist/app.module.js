"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const database_module_1 = require("./core/database/database.module");
const users_module_1 = require("./modules/users/users.module");
const notifications_module_1 = require("./modules/notifications/notifications.module");
const campus_module_1 = require("./modules/campus/campus.module");
const buildings_module_1 = require("./modules/buildings/buildings.module");
const departments_module_1 = require("./modules/departments/departments.module");
const meters_module_1 = require("./modules/meters/meters.module");
const meter_readings_module_1 = require("./modules/meter-readings/meter-readings.module");
const wastage_reports_module_1 = require("./modules/wastage-reports/wastage-reports.module");
const alerts_module_1 = require("./modules/alerts/alerts.module");
const faults_module_1 = require("./modules/faults/faults.module");
const service_requests_module_1 = require("./modules/service-requests/service-requests.module");
const work_orders_module_1 = require("./modules/work-orders/work-orders.module");
const energy_costs_module_1 = require("./modules/energy-costs/energy-costs.module");
const invoices_module_1 = require("./modules/invoices/invoices.module");
const financial_reports_module_1 = require("./modules/financial-reports/financial-reports.module");
const sustainability_metrics_module_1 = require("./modules/sustainability-metrics/sustainability-metrics.module");
const initiatives_module_1 = require("./modules/initiatives/initiatives.module");
const activity_logs_module_1 = require("./modules/activity-logs/activity-logs.module");
const sustainability_reports_module_1 = require("./modules/sustainability-reports/sustainability-reports.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            users_module_1.UsersModule, notifications_module_1.NotificationsModule, campus_module_1.CampusModule, buildings_module_1.BuildingsModule,
            departments_module_1.DepartmentsModule, meters_module_1.MetersModule, meter_readings_module_1.MeterReadingsModule, wastage_reports_module_1.WastageReportsModule,
            alerts_module_1.AlertsModule, faults_module_1.FaultsModule, service_requests_module_1.ServiceRequestsModule, work_orders_module_1.WorkOrdersModule,
            energy_costs_module_1.EnergyCostsModule, invoices_module_1.InvoicesModule, financial_reports_module_1.FinancialReportsModule, sustainability_metrics_module_1.SustainabilityMetricsModule,
            initiatives_module_1.InitiativesModule, activity_logs_module_1.ActivityLogsModule, sustainability_reports_module_1.SustainabilityReportsModule
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map