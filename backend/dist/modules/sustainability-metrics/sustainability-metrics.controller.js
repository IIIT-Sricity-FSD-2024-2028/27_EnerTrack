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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SustainabilityMetricsController = void 0;
const swagger_1 = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const sustainability_metrics_service_1 = require("./sustainability-metrics.service");
const create_sustainability_metric_dto_1 = require("./dto/create-sustainability-metric.dto");
const update_sustainability_metric_dto_1 = require("./dto/update-sustainability-metric.dto");
const roles_decorator_1 = require("../../core/decorators/roles.decorator");
let SustainabilityMetricsController = class SustainabilityMetricsController {
    constructor(sustainabilityMetricsService) {
        this.sustainabilityMetricsService = sustainabilityMetricsService;
    }
    create(createDto) {
        return this.sustainabilityMetricsService.create(createDto);
    }
    findAll() {
        return this.sustainabilityMetricsService.findAll();
    }
    findOne(id) {
        return this.sustainabilityMetricsService.findOne(id);
    }
    update(id, updateDto) {
        return this.sustainabilityMetricsService.update(id, updateDto);
    }
    remove(id) {
        return this.sustainabilityMetricsService.remove(id);
    }
};
exports.SustainabilityMetricsController = SustainabilityMetricsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create record' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    (0, roles_decorator_1.Roles)('Sustainability Officer', 'System Administrator'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_sustainability_metric_dto_1.CreateSustainabilityMetricDto]),
    __metadata("design:returntype", void 0)
], SustainabilityMetricsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Retrieve record(s)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SustainabilityMetricsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Retrieve record(s)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not Found' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SustainabilityMetricsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update record' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not Found' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    (0, roles_decorator_1.Roles)('Sustainability Officer', 'System Administrator'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_sustainability_metric_dto_1.UpdateSustainabilityMetricDto]),
    __metadata("design:returntype", void 0)
], SustainabilityMetricsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete record' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not Found' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    (0, roles_decorator_1.Roles)('System Administrator'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SustainabilityMetricsController.prototype, "remove", null);
exports.SustainabilityMetricsController = SustainabilityMetricsController = __decorate([
    (0, swagger_1.ApiTags)('sustainability-metrics'),
    (0, common_1.Controller)('sustainability-metrics'),
    __metadata("design:paramtypes", [sustainability_metrics_service_1.SustainabilityMetricsService])
], SustainabilityMetricsController);
//# sourceMappingURL=sustainability-metrics.controller.js.map