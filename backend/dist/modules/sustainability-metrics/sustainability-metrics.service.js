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
exports.SustainabilityMetricsService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../core/database/database.service");
let SustainabilityMetricsService = class SustainabilityMetricsService {
    constructor(database) {
        this.database = database;
    }
    create(createDto) {
        const generatedId = crypto.randomUUID();
        const newRecord = { sustainability_metric_id: generatedId, ...createDto };
        this.database.sustainabilityMetrics.push(newRecord);
        return newRecord;
    }
    findAll() {
        return this.database.sustainabilityMetrics;
    }
    findOne(id) {
        const record = this.database.sustainabilityMetrics.find(item => item.sustainability_metric_id === id);
        if (!record)
            throw new common_1.NotFoundException(`SustainabilityMetric with ID ${id} not found`);
        return record;
    }
    update(id, updateDto) {
        const index = this.database.sustainabilityMetrics.findIndex(item => item.sustainability_metric_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`SustainabilityMetric with ID ${id} not found`);
        this.database.sustainabilityMetrics[index] = { ...this.database.sustainabilityMetrics[index], ...updateDto };
        return this.database.sustainabilityMetrics[index];
    }
    remove(id) {
        const index = this.database.sustainabilityMetrics.findIndex(item => item.sustainability_metric_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`SustainabilityMetric with ID ${id} not found`);
        const removed = this.database.sustainabilityMetrics.splice(index, 1);
        return removed[0];
    }
};
exports.SustainabilityMetricsService = SustainabilityMetricsService;
exports.SustainabilityMetricsService = SustainabilityMetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], SustainabilityMetricsService);
//# sourceMappingURL=sustainability-metrics.service.js.map