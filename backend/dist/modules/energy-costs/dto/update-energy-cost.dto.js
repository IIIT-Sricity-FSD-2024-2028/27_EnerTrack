"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateEnergyCostDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_energy_cost_dto_1 = require("./create-energy-cost.dto");
class UpdateEnergyCostDto extends (0, mapped_types_1.PartialType)(create_energy_cost_dto_1.CreateEnergyCostDto) {
}
exports.UpdateEnergyCostDto = UpdateEnergyCostDto;
//# sourceMappingURL=update-energy-cost.dto.js.map