"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateBuildingDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_building_dto_1 = require("./create-building.dto");
class UpdateBuildingDto extends (0, mapped_types_1.PartialType)(create_building_dto_1.CreateBuildingDto) {
}
exports.UpdateBuildingDto = UpdateBuildingDto;
//# sourceMappingURL=update-building.dto.js.map