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
exports.AlertsService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../core/database/database.service");
let AlertsService = class AlertsService {
    constructor(database) {
        this.database = database;
    }
    create(createDto) {
        if (createDto.meter_id) {
            const exists = this.database.meters.find(x => x.meter_id === createDto.meter_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target meters with id '${createDto.meter_id}' not found`);
        }
        if (createDto.triggering_reading_id) {
            const exists = this.database.meterReadings.find(x => x.reading_id === createDto.triggering_reading_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target meterReadings with id '${createDto.triggering_reading_id}' not found`);
        }
        const generatedId = crypto.randomUUID();
        const newRecord = { alert_id: generatedId, ...createDto };
        this.database.alerts.push(newRecord);
        return newRecord;
    }
    findAll() {
        return this.database.alerts;
    }
    findOne(id) {
        const record = this.database.alerts.find(item => item.alert_id === id);
        if (!record)
            throw new common_1.NotFoundException(`Alert with ID ${id} not found`);
        return record;
    }
    update(id, updateDto) {
        const index = this.database.alerts.findIndex(item => item.alert_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Alert with ID ${id} not found`);
        this.database.alerts[index] = { ...this.database.alerts[index], ...updateDto };
        return this.database.alerts[index];
    }
    remove(id) {
        const index = this.database.alerts.findIndex(item => item.alert_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Alert with ID ${id} not found`);
        const removed = this.database.alerts.splice(index, 1);
        return removed[0];
    }
    getFaults(id) {
        return this.database.faults.filter(item => item.alert_id === id);
    }
    addMessage(id, message) {
        const index = this.database.alerts.findIndex(item => item.alert_id === id);
        if (index > -1) {
            if (!this.database.alerts[index].messages) {
                this.database.alerts[index].messages = [];
            }
            this.database.alerts[index].messages.push(message);
            return this.database.alerts[index];
        }
        return null;
    }
};
exports.AlertsService = AlertsService;
exports.AlertsService = AlertsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], AlertsService);
//# sourceMappingURL=alerts.service.js.map