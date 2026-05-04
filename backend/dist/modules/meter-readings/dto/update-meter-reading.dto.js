"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateMeterReadingDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_meter_reading_dto_1 = require("./create-meter-reading.dto");
class UpdateMeterReadingDto extends (0, mapped_types_1.PartialType)(create_meter_reading_dto_1.CreateMeterReadingDto) {
}
exports.UpdateMeterReadingDto = UpdateMeterReadingDto;
//# sourceMappingURL=update-meter-reading.dto.js.map