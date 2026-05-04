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
exports.MetersService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../core/database/database.service");
let MetersService = class MetersService {
    constructor(database) {
        this.database = database;
    }
    create(createDto) {
        if (createDto.meter_code) {
            const exists = this.database.meters.find(x => x.meter_code === createDto.meter_code);
            if (exists)
                throw new common_1.ConflictException(`Duplicate meter_code '${createDto.meter_code}'`);
        }
        if (createDto.building_id) {
            const exists = this.database.buildings.find(x => x.building_id === createDto.building_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target buildings with id '${createDto.building_id}' not found`);
        }
        const generatedId = crypto.randomUUID();
        const newRecord = { meter_id: generatedId, ...createDto };
        this.database.meters.push(newRecord);
        return newRecord;
    }
    findAll() {
        return this.database.meters;
    }
    findOne(id) {
        const record = this.database.meters.find(item => item.meter_id === id);
        if (!record)
            throw new common_1.NotFoundException(`Meter with ID ${id} not found`);
        return record;
    }
    update(id, updateDto) {
        const index = this.database.meters.findIndex(item => item.meter_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Meter with ID ${id} not found`);
        this.database.meters[index] = { ...this.database.meters[index], ...updateDto };
        return this.database.meters[index];
    }
    remove(id) {
        const index = this.database.meters.findIndex(item => item.meter_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Meter with ID ${id} not found`);
        const removed = this.database.meters.splice(index, 1);
        return removed[0];
    }
    getReadings(id) {
        return this.database.meterReadings.filter(item => item.meter_id === id);
    }
    getAlerts(id) {
        return this.database.alerts.filter(item => item.meter_id === id);
    }
};
exports.MetersService = MetersService;
exports.MetersService = MetersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], MetersService);
//# sourceMappingURL=meters.service.js.map