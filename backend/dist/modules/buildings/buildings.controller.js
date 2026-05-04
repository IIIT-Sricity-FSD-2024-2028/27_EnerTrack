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
exports.BuildingsController = void 0;
const swagger_1 = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const buildings_service_1 = require("./buildings.service");
const create_building_dto_1 = require("./dto/create-building.dto");
const update_building_dto_1 = require("./dto/update-building.dto");
const roles_decorator_1 = require("../../core/decorators/roles.decorator");
let BuildingsController = class BuildingsController {
    constructor(buildingsService) {
        this.buildingsService = buildingsService;
    }
    create(createDto) {
        return this.buildingsService.create(createDto);
    }
    findAll() {
        return this.buildingsService.findAll();
    }
    findOne(id) {
        return this.buildingsService.findOne(id);
    }
    update(id, updateDto) {
        return this.buildingsService.update(id, updateDto);
    }
    remove(id) {
        return this.buildingsService.remove(id);
    }
    getDepartments(id) {
        return this.buildingsService.getDepartments(id);
    }
    getMeters(id) {
        return this.buildingsService.getMeters(id);
    }
};
exports.BuildingsController = BuildingsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create record' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    (0, roles_decorator_1.Roles)('System Administrator'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_building_dto_1.CreateBuildingDto]),
    __metadata("design:returntype", void 0)
], BuildingsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Retrieve record(s)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BuildingsController.prototype, "findAll", null);
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
], BuildingsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update record' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not Found' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    (0, roles_decorator_1.Roles)('System Administrator'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_building_dto_1.UpdateBuildingDto]),
    __metadata("design:returntype", void 0)
], BuildingsController.prototype, "update", null);
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
], BuildingsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/departments'),
    (0, swagger_1.ApiOperation)({ summary: 'Retrieve record(s)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BuildingsController.prototype, "getDepartments", null);
__decorate([
    (0, common_1.Get)(':id/meters'),
    (0, swagger_1.ApiOperation)({ summary: 'Retrieve record(s)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BuildingsController.prototype, "getMeters", null);
exports.BuildingsController = BuildingsController = __decorate([
    (0, swagger_1.ApiTags)('buildings'),
    (0, common_1.Controller)('buildings'),
    __metadata("design:paramtypes", [buildings_service_1.BuildingsService])
], BuildingsController);
//# sourceMappingURL=buildings.controller.js.map