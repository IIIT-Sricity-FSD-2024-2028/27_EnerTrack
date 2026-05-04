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
exports.FinancialReportsService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../core/database/database.service");
let FinancialReportsService = class FinancialReportsService {
    constructor(database) {
        this.database = database;
    }
    create(createDto) {
        if (createDto.generated_by_id) {
            const exists = this.database.users.find(x => x.user_id === createDto.generated_by_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target users with id '${createDto.generated_by_id}' not found`);
        }
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
        const newRecord = { financial_report_id: generatedId, ...createDto };
        this.database.financialReports.push(newRecord);
        return newRecord;
    }
    findAll() {
        return this.database.financialReports;
    }
    findOne(id) {
        const record = this.database.financialReports.find(item => item.financial_report_id === id);
        if (!record)
            throw new common_1.NotFoundException(`FinancialReport with ID ${id} not found`);
        return record;
    }
    update(id, updateDto) {
        const index = this.database.financialReports.findIndex(item => item.financial_report_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`FinancialReport with ID ${id} not found`);
        this.database.financialReports[index] = { ...this.database.financialReports[index], ...updateDto };
        return this.database.financialReports[index];
    }
    remove(id) {
        const index = this.database.financialReports.findIndex(item => item.financial_report_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`FinancialReport with ID ${id} not found`);
        const removed = this.database.financialReports.splice(index, 1);
        return removed[0];
    }
};
exports.FinancialReportsService = FinancialReportsService;
exports.FinancialReportsService = FinancialReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], FinancialReportsService);
//# sourceMappingURL=financial-reports.service.js.map