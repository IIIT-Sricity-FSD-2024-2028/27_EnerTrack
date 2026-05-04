"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateInitiativeDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_initiative_dto_1 = require("./create-initiative.dto");
class UpdateInitiativeDto extends (0, mapped_types_1.PartialType)(create_initiative_dto_1.CreateInitiativeDto) {
}
exports.UpdateInitiativeDto = UpdateInitiativeDto;
//# sourceMappingURL=update-initiative.dto.js.map