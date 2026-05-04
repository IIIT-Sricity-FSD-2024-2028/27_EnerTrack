"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkOrdersService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../core/database/database.service");
let WorkOrdersService = class WorkOrdersService {
    constructor(database) {
        this.database = database;
    }
    create(createDto) {
        if (createDto.assigned_to_id) {
            const exists = this.database.users.find(x => x.user_id === createDto.assigned_to_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target users with id '${createDto.assigned_to_id}' not found`);
        }
        if (createDto.linked_fault_id) {
            const exists = this.database.faults.find(x => x.fault_id === createDto.linked_fault_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target faults with id '${createDto.linked_fault_id}' not found`);
        }
        if (createDto.source_request_id) {
            const exists = this.database.serviceRequests.find(x => x.service_request_id === createDto.source_request_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target serviceRequests with id '${createDto.source_request_id}' not found`);
        }
        const generatedId = crypto.randomUUID();
        const newRecord = { work_order_id: generatedId, ...createDto };
        this.database.workOrders.push(newRecord);
        return newRecord;
    }
    findAll() {
        return this.database.workOrders;
    }
    findOne(id) {
        const record = this.database.workOrders.find(item => item.work_order_id === id);
        if (!record)
            throw new common_1.NotFoundException(`WorkOrder with ID ${id} not found`);
        return record;
    }
    update(id, updateDto) {
        const index = this.database.workOrders.findIndex(item => item.work_order_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`WorkOrder with ID ${id} not found`);
        this.database.workOrders[index] = { ...this.database.workOrders[index], ...updateDto };
        return this.database.workOrders[index];
    }
    remove(id) {
        const index = this.database.workOrders.findIndex(item => item.work_order_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`WorkOrder with ID ${id} not found`);
        const removed = this.database.workOrders.splice(index, 1);
        return removed[0];
    }
};
exports.WorkOrdersService = WorkOrdersService;
exports.WorkOrdersService = WorkOrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], WorkOrdersService);
//# sourceMappingURL=work-orders.service.js.map