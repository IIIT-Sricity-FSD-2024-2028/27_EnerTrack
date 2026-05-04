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
exports.CampusService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../core/database/database.service");
let CampusService = class CampusService {
    constructor(database) {
        this.database = database;
    }
    create(createDto) {
        const generatedId = crypto.randomUUID();
        const newRecord = { campus_id: generatedId, ...createDto };
        this.database.campus.push(newRecord);
        return newRecord;
    }
    findAll() {
        return this.database.campus;
    }
    findOne(id) {
        const record = this.database.campus.find(item => item.campus_id === id);
        if (!record)
            throw new common_1.NotFoundException(`Campus with ID ${id} not found`);
        return record;
    }
    update(id, updateDto) {
        const index = this.database.campus.findIndex(item => item.campus_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Campus with ID ${id} not found`);
        this.database.campus[index] = { ...this.database.campus[index], ...updateDto };
        return this.database.campus[index];
    }
    remove(id) {
        const index = this.database.campus.findIndex(item => item.campus_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Campus with ID ${id} not found`);
        const removed = this.database.campus.splice(index, 1);
        return removed[0];
    }
    getBuildings(id) {
        return this.database.buildings.filter(item => item.campus_id === id);
    }
};
exports.CampusService = CampusService;
exports.CampusService = CampusService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], CampusService);
//# sourceMappingURL=campus.service.js.map