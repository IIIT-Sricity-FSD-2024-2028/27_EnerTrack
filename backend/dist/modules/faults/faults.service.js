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
exports.FaultsService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../core/database/database.service");
let FaultsService = class FaultsService {
    constructor(database) {
        this.database = database;
    }
    create(createDto) {
        if (createDto.alert_id) {
            const exists = this.database.alerts.find(x => x.alert_id === createDto.alert_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target alerts with id '${createDto.alert_id}' not found`);
        }
        if (createDto.assigned_to_id) {
            const exists = this.database.users.find(x => x.user_id === createDto.assigned_to_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target users with id '${createDto.assigned_to_id}' not found`);
        }
        const generatedId = crypto.randomUUID();
        const newRecord = { fault_id: generatedId, ...createDto };
        this.database.faults.push(newRecord);
        return newRecord;
    }
    findAll() {
        return this.database.faults;
    }
    findOne(id) {
        const record = this.database.faults.find(item => item.fault_id === id);
        if (!record)
            throw new common_1.NotFoundException(`Fault with ID ${id} not found`);
        return record;
    }
    update(id, updateDto) {
        const index = this.database.faults.findIndex(item => item.fault_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Fault with ID ${id} not found`);
        this.database.faults[index] = { ...this.database.faults[index], ...updateDto };
        return this.database.faults[index];
    }
    remove(id) {
        const index = this.database.faults.findIndex(item => item.fault_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Fault with ID ${id} not found`);
        const removed = this.database.faults.splice(index, 1);
        return removed[0];
    }
    getWorkOrders(id) {
        return this.database.workOrders.filter(item => item.linked_fault_id === id);
    }
};
exports.FaultsService = FaultsService;
exports.FaultsService = FaultsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], FaultsService);
//# sourceMappingURL=faults.service.js.map