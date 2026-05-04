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
exports.DatabaseService = exports.InitiativeStatus = exports.InvoiceStatus = exports.EnergyCostStatus = exports.WorkOrderStatus = exports.WorkOrderPriority = exports.FaultStatus = exports.FaultSeverity = exports.AlertStatus = exports.WastageType = exports.MeterStatus = exports.MeterType = exports.NotificationTargetType = exports.UserRole = void 0;
var common_1 = require("@nestjs/common");
var UserRole;
(function (UserRole) {
    UserRole["SYSTEM_ADMINISTRATOR"] = "System Administrator";
    UserRole["FINANCIAL_ANALYST"] = "Financial Analyst";
    UserRole["TECHNICIAN"] = "Technician";
    UserRole["SUSTAINABILITY_OFFICER"] = "Sustainability Officer";
    UserRole["CAMPUS_VISITOR"] = "Campus Visitor";
})(UserRole || (exports.UserRole = UserRole = {}));
var NotificationTargetType;
(function (NotificationTargetType) {
    NotificationTargetType["WASTAGE"] = "wastage";
    NotificationTargetType["ALERT"] = "alert";
    NotificationTargetType["REQUEST"] = "request";
})(NotificationTargetType || (exports.NotificationTargetType = NotificationTargetType = {}));
var MeterType;
(function (MeterType) {
    MeterType["ELECTRICITY"] = "electricity";
    MeterType["GAS"] = "gas";
    MeterType["WATER"] = "water";
    MeterType["EMISSIONS"] = "emissions";
    MeterType["FOOD"] = "food";
})(MeterType || (exports.MeterType = MeterType = {}));
var MeterStatus;
(function (MeterStatus) {
    MeterStatus["ACTIVE"] = "active";
    MeterStatus["FAULTY"] = "faulty";
    MeterStatus["CALIBRATING"] = "calibrating";
    MeterStatus["DECOMMISSIONED"] = "decommissioned";
})(MeterStatus || (exports.MeterStatus = MeterStatus = {}));
var WastageType;
(function (WastageType) {
    WastageType["ENERGY"] = "Energy";
    WastageType["WATER"] = "Water";
    WastageType["FOOD"] = "Food";
})(WastageType || (exports.WastageType = WastageType = {}));
var AlertStatus;
(function (AlertStatus) {
    AlertStatus["OPEN"] = "open";
    AlertStatus["ACKNOWLEDGED"] = "acknowledged";
    AlertStatus["RESOLVED"] = "resolved";
})(AlertStatus || (exports.AlertStatus = AlertStatus = {}));
var FaultSeverity;
(function (FaultSeverity) {
    FaultSeverity["LOW"] = "low";
    FaultSeverity["MODERATE"] = "moderate";
    FaultSeverity["HIGH"] = "high";
    FaultSeverity["CRITICAL"] = "critical";
})(FaultSeverity || (exports.FaultSeverity = FaultSeverity = {}));
var FaultStatus;
(function (FaultStatus) {
    FaultStatus["ACTIVE"] = "active";
    FaultStatus["PENDING"] = "pending";
    FaultStatus["RESOLVED"] = "resolved";
})(FaultStatus || (exports.FaultStatus = FaultStatus = {}));
var WorkOrderPriority;
(function (WorkOrderPriority) {
    WorkOrderPriority["IMMEDIATE"] = "immediate";
    WorkOrderPriority["HIGH"] = "high";
    WorkOrderPriority["MEDIUM"] = "medium";
    WorkOrderPriority["LOW"] = "low";
})(WorkOrderPriority || (exports.WorkOrderPriority = WorkOrderPriority = {}));
var WorkOrderStatus;
(function (WorkOrderStatus) {
    WorkOrderStatus["NEW"] = "new";
    WorkOrderStatus["INPROGRESS"] = "inprogress";
    WorkOrderStatus["REVIEW"] = "review";
    WorkOrderStatus["CLOSED"] = "closed";
})(WorkOrderStatus || (exports.WorkOrderStatus = WorkOrderStatus = {}));
var EnergyCostStatus;
(function (EnergyCostStatus) {
    EnergyCostStatus["UNDER_BUDGET"] = "under-budget";
    EnergyCostStatus["ON_BUDGET"] = "on-budget";
    EnergyCostStatus["OVER_BUDGET"] = "over-budget";
})(EnergyCostStatus || (exports.EnergyCostStatus = EnergyCostStatus = {}));
var InvoiceStatus;
(function (InvoiceStatus) {
    InvoiceStatus["PENDING"] = "pending";
    InvoiceStatus["APPROVED"] = "approved";
    InvoiceStatus["OVERDUE"] = "overdue";
    InvoiceStatus["PAID"] = "paid";
})(InvoiceStatus || (exports.InvoiceStatus = InvoiceStatus = {}));
var InitiativeStatus;
(function (InitiativeStatus) {
    InitiativeStatus["PROPOSED"] = "proposed";
    InitiativeStatus["IN_PROGRESS"] = "in-progress";
    InitiativeStatus["APPROVED"] = "approved";
    InitiativeStatus["COMPLETED"] = "completed";
    InitiativeStatus["REJECTED"] = "rejected";
})(InitiativeStatus || (exports.InitiativeStatus = InitiativeStatus = {}));
var DatabaseService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var DatabaseService = _classThis = /** @class */ (function () {
        function DatabaseService_1() {
            this.users = [
                { user_id: 'u1', name: 'Alice Admin', email: 'alice@enertrack.com', phone: null, password: 'hashedpassword', role: UserRole.SYSTEM_ADMINISTRATOR, specialization: null },
                { user_id: 'u2', name: 'Bob Tech', email: 'bob@enertrack.com', phone: '1234567890', password: 'hashedpassword', role: UserRole.TECHNICIAN, specialization: 'HVAC' }
            ];
            this.notifications = [];
            this.campus = [
                { campus_id: 'c1', name: 'Main Campus', location: 'Downtown', total_budget: 1000000 }
            ];
            this.buildings = [
                { building_id: 'b1', campus_id: 'c1', name: 'Engineering Block', budget: 500000 }
            ];
            this.departments = [
                { department_id: 'd1', building_id: 'b1', name: 'Mechanical Dept', budget: 100000 }
            ];
            this.meters = [
                { meter_id: 'm1', building_id: 'b1', meter_code: 'ELEC-001', meter_type: MeterType.ELECTRICITY, zone: 'North', status: MeterStatus.ACTIVE }
            ];
            this.meterReadings = [
                { reading_id: 'r1', meter_id: 'm1', value: 120.5, unit: 'kWh', timestamp: new Date().toISOString() }
            ];
            this.wastageReports = [
                { wastage_report_id: 'wr1', reporter_id: 'u1', type: WastageType.ENERGY, status: 'reported', details: {}, sensor_reading_id: null }
            ];
            this.alerts = [
                { alert_id: 'a1', meter_id: 'm1', triggering_reading_id: 'r1', title: 'High Energy Usage', severity: 'High', status: AlertStatus.OPEN, messages: [] }
            ];
            this.faults = [];
            this.serviceRequests = [];
            this.workOrders = [];
            this.energyCosts = [];
            this.invoices = [];
            this.financialReports = [];
            this.sustainabilityMetrics = [];
            this.initiatives = [];
            this.activityLogs = [];
            this.sustainabilityReports = [];
        }
        return DatabaseService_1;
    }());
    __setFunctionName(_classThis, "DatabaseService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        DatabaseService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return DatabaseService = _classThis;
}();
exports.DatabaseService = DatabaseService;
