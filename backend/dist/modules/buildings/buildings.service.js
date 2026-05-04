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
exports.BuildingsService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../core/database/database.service");
let BuildingsService = class BuildingsService {
    constructor(database) {
        this.database = database;
    }
    create(createDto) {
        if (createDto.campus_id) {
            const exists = this.database.campus.find(x => x.campus_id === createDto.campus_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target campus with id '${createDto.campus_id}' not found`);
        }
        const generatedId = crypto.randomUUID();
        const newRecord = { building_id: generatedId, ...createDto };
        this.database.buildings.push(newRecord);
        return newRecord;
    }
    findAll() {
        return this.database.buildings;
    }
    findOne(id) {
        const record = this.database.buildings.find(item => item.building_id === id);
        if (!record)
            throw new common_1.NotFoundException(`Building with ID ${id} not found`);
        return record;
    }
    update(id, updateDto) {
        const index = this.database.buildings.findIndex(item => item.building_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Building with ID ${id} not found`);
        this.database.buildings[index] = { ...this.database.buildings[index], ...updateDto };
        return this.database.buildings[index];
    }
    remove(id) {
        const index = this.database.buildings.findIndex(item => item.building_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Building with ID ${id} not found`);
        const removed = this.database.buildings.splice(index, 1);
        return removed[0];
    }
    getDepartments(id) {
        return this.database.departments.filter(item => item.building_id === id);
    }
    getMeters(id) {
        return this.database.meters.filter(item => item.building_id === id);
    }
};
exports.BuildingsService = BuildingsService;
exports.BuildingsService = BuildingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], BuildingsService);
//# sourceMappingURL=buildings.service.js.map