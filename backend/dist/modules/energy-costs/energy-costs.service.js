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
exports.EnergyCostsService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../core/database/database.service");
let EnergyCostsService = class EnergyCostsService {
    constructor(database) {
        this.database = database;
    }
    create(createDto) {
        if (createDto.building_id) {
            const exists = this.database.buildings.find(x => x.building_id === createDto.building_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target buildings with id '${createDto.building_id}' not found`);
        }
        if (createDto.department_id) {
            const exists = this.database.departments.find(x => x.department_id === createDto.department_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target departments with id '${createDto.department_id}' not found`);
        }
        const generatedId = crypto.randomUUID();
        const newRecord = { energy_cost_id: generatedId, ...createDto };
        this.database.energyCosts.push(newRecord);
        return newRecord;
    }
    findAll() {
        return this.database.energyCosts;
    }
    findOne(id) {
        const record = this.database.energyCosts.find(item => item.energy_cost_id === id);
        if (!record)
            throw new common_1.NotFoundException(`EnergyCost with ID ${id} not found`);
        return record;
    }
    update(id, updateDto) {
        const index = this.database.energyCosts.findIndex(item => item.energy_cost_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`EnergyCost with ID ${id} not found`);
        this.database.energyCosts[index] = { ...this.database.energyCosts[index], ...updateDto };
        return this.database.energyCosts[index];
    }
    remove(id) {
        const index = this.database.energyCosts.findIndex(item => item.energy_cost_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`EnergyCost with ID ${id} not found`);
        const removed = this.database.energyCosts.splice(index, 1);
        return removed[0];
    }
    getByPeriod(period) {
        return this.database.energyCosts.filter(item => item.period === period);
    }
};
exports.EnergyCostsService = EnergyCostsService;
exports.EnergyCostsService = EnergyCostsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], EnergyCostsService);
//# sourceMappingURL=energy-costs.service.js.map