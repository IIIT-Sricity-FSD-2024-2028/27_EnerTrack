"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampusModule = void 0;
const common_1 = require("@nestjs/common");
const campus_service_1 = require("./campus.service");
const campus_controller_1 = require("./campus.controller");
const database_module_1 = require("../../core/database/database.module");
let CampusModule = class CampusModule {
};
exports.CampusModule = CampusModule;
exports.CampusModule = CampusModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule],
        controllers: [campus_controller_1.CampusController],
        providers: [campus_service_1.CampusService],
    })
], CampusModule);
//# sourceMappingURL=campus.module.js.map