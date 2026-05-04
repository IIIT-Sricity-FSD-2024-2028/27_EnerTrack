"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateServiceRequestDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_service_request_dto_1 = require("./create-service-request.dto");
class UpdateServiceRequestDto extends (0, mapped_types_1.PartialType)(create_service_request_dto_1.CreateServiceRequestDto) {
}
exports.UpdateServiceRequestDto = UpdateServiceRequestDto;
//# sourceMappingURL=update-service-request.dto.js.map