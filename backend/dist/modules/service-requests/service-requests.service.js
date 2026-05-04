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
exports.ServiceRequestsService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../core/database/database.service");
let ServiceRequestsService = class ServiceRequestsService {
    constructor(database) {
        this.database = database;
    }
    create(createDto) {
        if (createDto.reporter_id) {
            const exists = this.database.users.find(x => x.user_id === createDto.reporter_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target users with id '${createDto.reporter_id}' not found`);
        }
        if (createDto.assigned_to_id) {
            const exists = this.database.users.find(x => x.user_id === createDto.assigned_to_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target users with id '${createDto.assigned_to_id}' not found`);
        }
        const generatedId = crypto.randomUUID();
        const newRecord = { service_request_id: generatedId, ...createDto };
        this.database.serviceRequests.push(newRecord);
        return newRecord;
    }
    findAll() {
        return this.database.serviceRequests;
    }
    findOne(id) {
        const record = this.database.serviceRequests.find(item => item.service_request_id === id);
        if (!record)
            throw new common_1.NotFoundException(`ServiceRequest with ID ${id} not found`);
        return record;
    }
    update(id, updateDto) {
        const index = this.database.serviceRequests.findIndex(item => item.service_request_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`ServiceRequest with ID ${id} not found`);
        this.database.serviceRequests[index] = { ...this.database.serviceRequests[index], ...updateDto };
        return this.database.serviceRequests[index];
    }
    remove(id) {
        const index = this.database.serviceRequests.findIndex(item => item.service_request_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`ServiceRequest with ID ${id} not found`);
        const removed = this.database.serviceRequests.splice(index, 1);
        return removed[0];
    }
    getWorkOrders(id) {
        return this.database.workOrders.filter(item => item.source_request_id === id);
    }
};
exports.ServiceRequestsService = ServiceRequestsService;
exports.ServiceRequestsService = ServiceRequestsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], ServiceRequestsService);
//# sourceMappingURL=service-requests.service.js.map