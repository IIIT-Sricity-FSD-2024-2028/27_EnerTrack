"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateFaultDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_fault_dto_1 = require("./create-fault.dto");
class UpdateFaultDto extends (0, mapped_types_1.PartialType)(create_fault_dto_1.CreateFaultDto) {
}
exports.UpdateFaultDto = UpdateFaultDto;
//# sourceMappingURL=update-fault.dto.js.map