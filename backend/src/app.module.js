"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
var common_1 = require("@nestjs/common");
var app_controller_1 = require("./app.controller");
var app_service_1 = require("./app.service");
var database_module_1 = require("./core/database/database.module");
var users_module_1 = require("./modules/users/users.module");
var notifications_module_1 = require("./modules/notifications/notifications.module");
var campus_module_1 = require("./modules/campus/campus.module");
var buildings_module_1 = require("./modules/buildings/buildings.module");
var departments_module_1 = require("./modules/departments/departments.module");
var meters_module_1 = require("./modules/meters/meters.module");
var meter_readings_module_1 = require("./modules/meter-readings/meter-readings.module");
var wastage_reports_module_1 = require("./modules/wastage-reports/wastage-reports.module");
var alerts_module_1 = require("./modules/alerts/alerts.module");
var faults_module_1 = require("./modules/faults/faults.module");
var service_requests_module_1 = require("./modules/service-requests/service-requests.module");
var work_orders_module_1 = require("./modules/work-orders/work-orders.module");
var energy_costs_module_1 = require("./modules/energy-costs/energy-costs.module");
var invoices_module_1 = require("./modules/invoices/invoices.module");
var financial_reports_module_1 = require("./modules/financial-reports/financial-reports.module");
var sustainability_metrics_module_1 = require("./modules/sustainability-metrics/sustainability-metrics.module");
var initiatives_module_1 = require("./modules/initiatives/initiatives.module");
var activity_logs_module_1 = require("./modules/activity-logs/activity-logs.module");
var sustainability_reports_module_1 = require("./modules/sustainability-reports/sustainability-reports.module");
var AppModule = function () {
    var _classDecorators = [(0, common_1.Module)({
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
        })];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var AppModule = _classThis = /** @class */ (function () {
        function AppModule_1() {
        }
        return AppModule_1;
    }());
    __setFunctionName(_classThis, "AppModule");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        AppModule = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return AppModule = _classThis;
}();
exports.AppModule = AppModule;
