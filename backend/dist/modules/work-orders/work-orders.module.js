"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkOrdersModule = void 0;
const common_1 = require("@nestjs/common");
const work_orders_service_1 = require("./work-orders.service");
const work_orders_controller_1 = require("./work-orders.controller");
const database_module_1 = require("../../core/database/database.module");
let WorkOrdersModule = class WorkOrdersModule {
};
exports.WorkOrdersModule = WorkOrdersModule;
exports.WorkOrdersModule = WorkOrdersModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule],
        controllers: [work_orders_controller_1.WorkOrdersController],
        providers: [work_orders_service_1.WorkOrdersService],
    })
], WorkOrdersModule);
//# sourceMappingURL=work-orders.module.js.map