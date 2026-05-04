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
exports.NotificationsService = void 0;
const crypto = require("crypto");
const common_1 = require("@nestjs/common");
const database_service_1 = require("../../core/database/database.service");
let NotificationsService = class NotificationsService {
    constructor(database) {
        this.database = database;
    }
    create(createDto) {
        if (createDto.user_id) {
            const exists = this.database.users.find(x => x.user_id === createDto.user_id);
            if (!exists)
                throw new common_1.NotFoundException(`Target users with id '${createDto.user_id}' not found`);
        }
        const generatedId = crypto.randomUUID();
        const newRecord = { notification_id: generatedId, ...createDto };
        this.database.notifications.push(newRecord);
        return newRecord;
    }
    findAll() {
        return this.database.notifications;
    }
    findOne(id) {
        const record = this.database.notifications.find(item => item.notification_id === id);
        if (!record)
            throw new common_1.NotFoundException(`Notification with ID ${id} not found`);
        return record;
    }
    update(id, updateDto) {
        const index = this.database.notifications.findIndex(item => item.notification_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Notification with ID ${id} not found`);
        this.database.notifications[index] = { ...this.database.notifications[index], ...updateDto };
        return this.database.notifications[index];
    }
    remove(id) {
        const index = this.database.notifications.findIndex(item => item.notification_id === id);
        if (index === -1)
            throw new common_1.NotFoundException(`Notification with ID ${id} not found`);
        const removed = this.database.notifications.splice(index, 1);
        return removed[0];
    }
    markRead(id) {
        const index = this.database.notifications.findIndex(item => item.notification_id === id);
        if (index > -1) {
            this.database.notifications[index].is_read = true;
            return this.database.notifications[index];
        }
        return null;
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map