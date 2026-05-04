"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCampusDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_campu_dto_1 = require("./create-campu.dto");
class UpdateCampusDto extends (0, mapped_types_1.PartialType)(create_campu_dto_1.CreateCampusDto) {
}
exports.UpdateCampusDto = UpdateCampusDto;
//# sourceMappingURL=update-campu.dto.js.map