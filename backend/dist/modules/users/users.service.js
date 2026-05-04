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
exports.UsersService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../core/database/database.service");
let UsersService = class UsersService {
    constructor(database) {
        this.database = database;
    }
    create(createDto) {
        if (createDto.email) {
            const exists = this.database.users.find(x => x.email === createDto.email);
            if (exists)
                throw new common_1.ConflictException(`Duplicate email '${createDto.email}'`);
        }
        if (createDto.phone) {
            const exists = this.database.users?.find(x => x.phone === createDto.phone);
            if (exists)
                throw new common_1.ConflictException(`Duplicate phone '${createDto.phone}'`);
        }
        const generatedId = crypto.randomUUID();
        const newRecord = { user_id: generatedId, ...createDto };
        this.database.users.push(newRecord);
        return newRecord;
    }
    findAll() {
        return this.database.users;
    }
    findOne(id) {
        const record = this.database.users.find(item => item.user_id === id);
        if (!record)
            throw new common_1.NotFoundException(`User with ID ${id} not found`);
        return record;
    }
    update(id, updateDto) {
        const index = this.database.users.findIndex(item => item.user_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`User with ID ${id} not found`);
        this.database.users[index] = { ...this.database.users[index], ...updateDto };
        return this.database.users[index];
    }
    remove(id) {
        const index = this.database.users.findIndex(item => item.user_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`User with ID ${id} not found`);
        const removed = this.database.users.splice(index, 1);
        return removed[0];
    }
    getNotifications(id) {
        return this.database.notifications.filter(item => item.user_id === id);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], UsersService);
//# sourceMappingURL=users.service.js.map