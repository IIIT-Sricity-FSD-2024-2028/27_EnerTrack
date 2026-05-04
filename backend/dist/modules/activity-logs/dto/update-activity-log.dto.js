"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateActivityLogDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_activity_log_dto_1 = require("./create-activity-log.dto");
class UpdateActivityLogDto extends (0, mapped_types_1.PartialType)(create_activity_log_dto_1.CreateActivityLogDto) {
}
exports.UpdateActivityLogDto = UpdateActivityLogDto;
//# sourceMappingURL=update-activity-log.dto.js.map