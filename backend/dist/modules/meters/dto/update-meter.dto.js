"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateMeterDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_meter_dto_1 = require("./create-meter.dto");
class UpdateMeterDto extends (0, mapped_types_1.PartialType)(create_meter_dto_1.CreateMeterDto) {
}
exports.UpdateMeterDto = UpdateMeterDto;
//# sourceMappingURL=update-meter.dto.js.map