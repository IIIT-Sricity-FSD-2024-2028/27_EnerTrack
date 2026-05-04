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
exports.DepartmentsService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../core/database/database.service");
let DepartmentsService = class DepartmentsService {
    constructor(database) {
        this.database = database;
    }
    create(createDto) {
        if (createDto.building_id) {
            const exists = this.database.buildings.find(x => x.building_id === createDto.building_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target buildings with id '${createDto.building_id}' not found`);
        }
        const generatedId = crypto.randomUUID();
        const newRecord = { department_id: generatedId, ...createDto };
        this.database.departments.push(newRecord);
        return newRecord;
    }
    findAll() {
        return this.database.departments;
    }
    findOne(id) {
        const record = this.database.departments.find(item => item.department_id === id);
        if (!record)
            throw new common_1.NotFoundException(`Department with ID ${id} not found`);
        return record;
    }
    update(id, updateDto) {
        const index = this.database.departments.findIndex(item => item.department_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Department with ID ${id} not found`);
        this.database.departments[index] = { ...this.database.departments[index], ...updateDto };
        return this.database.departments[index];
    }
    remove(id) {
        const index = this.database.departments.findIndex(item => item.department_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Department with ID ${id} not found`);
        const removed = this.database.departments.splice(index, 1);
        return removed[0];
    }
    getInvoices(id) {
        return this.database.invoices.filter(item => item.department_id === id);
    }
};
exports.DepartmentsService = DepartmentsService;
exports.DepartmentsService = DepartmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], DepartmentsService);
//# sourceMappingURL=departments.service.js.map