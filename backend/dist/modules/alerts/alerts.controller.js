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
exports.AlertsController = void 0;
const swagger_1 = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const alerts_service_1 = require("./alerts.service");
const create_alert_dto_1 = require("./dto/create-alert.dto");
const update_alert_dto_1 = require("./dto/update-alert.dto");
const roles_decorator_1 = require("../../core/decorators/roles.decorator");
const add_message_dto_1 = require("./dto/add-message.dto");
let AlertsController = class AlertsController {
    constructor(alertsService) {
        this.alertsService = alertsService;
    }
    create(createDto) {
        return this.alertsService.create(createDto);
    }
    findAll() {
        return this.alertsService.findAll();
    }
    findOne(id) {
        return this.alertsService.findOne(id);
    }
    update(id, updateDto) {
        return this.alertsService.update(id, updateDto);
    }
    remove(id) {
        return this.alertsService.remove(id);
    }
    addMessage(id, messageDto) {
        return this.alertsService.addMessage(id, messageDto);
    }
    getFaults(id) {
        return this.alertsService.getFaults(id);
    }
};
exports.AlertsController = AlertsController;
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create record' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    (0, roles_decorator_1.Roles)('System Administrator', 'Technician'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_alert_dto_1.CreateAlertDto]),
    __metadata("design:returntype", void 0)
], AlertsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Retrieve record(s)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AlertsController.prototype, "findAll", null);
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
], AlertsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update record' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Not Found' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    (0, roles_decorator_1.Roles)('System Administrator', 'Technician'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_alert_dto_1.UpdateAlertDto]),
    __metadata("design:returntype", void 0)
], AlertsController.prototype, "update", null);
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
], AlertsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/messages'),
    (0, swagger_1.ApiOperation)({ summary: 'Create record' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    (0, roles_decorator_1.Roles)('System Administrator', 'Technician'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, add_message_dto_1.AddMessageDto]),
    __metadata("design:returntype", void 0)
], AlertsController.prototype, "addMessage", null);
__decorate([
    (0, common_1.Get)(':id/faults'),
    (0, swagger_1.ApiOperation)({ summary: 'Retrieve record(s)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Successful response' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden (RBAC)' }),
    (0, swagger_1.ApiHeader)({ name: 'x-role', description: 'User role for RBAC. Enum: System Administrator | Financial Analyst | Technician | Sustainability Officer | Campus Visitor', required: false }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AlertsController.prototype, "getFaults", null);
exports.AlertsController = AlertsController = __decorate([
    (0, swagger_1.ApiTags)('alerts'),
    (0, common_1.Controller)('alerts'),
    __metadata("design:paramtypes", [alerts_service_1.AlertsService])
], AlertsController);
//# sourceMappingURL=alerts.controller.js.map