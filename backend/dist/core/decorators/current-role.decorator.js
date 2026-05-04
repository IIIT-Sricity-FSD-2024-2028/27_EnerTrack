"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentRole = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentRole = (0, common_1.createParamDecorator)((data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return request.headers['x-user-role'] || 'System Administrator';
});
//# sourceMappingURL=current-role.decorator.js.map