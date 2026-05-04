"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentRole = void 0;
var common_1 = require("@nestjs/common");
exports.CurrentRole = (0, common_1.createParamDecorator)(function (data, ctx) {
    var request = ctx.switchToHttp().getRequest();
    return request.headers['x-user-role'] || 'System Administrator';
});
