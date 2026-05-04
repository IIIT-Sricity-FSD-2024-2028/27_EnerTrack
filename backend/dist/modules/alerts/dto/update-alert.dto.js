"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAlertDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_alert_dto_1 = require("./create-alert.dto");
class UpdateAlertDto extends (0, mapped_types_1.PartialType)(create_alert_dto_1.CreateAlertDto) {
}
exports.UpdateAlertDto = UpdateAlertDto;
//# sourceMappingURL=update-alert.dto.js.map