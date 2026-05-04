"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateInvoiceDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_invoice_dto_1 = require("./create-invoice.dto");
class UpdateInvoiceDto extends (0, mapped_types_1.PartialType)(create_invoice_dto_1.CreateInvoiceDto) {
}
exports.UpdateInvoiceDto = UpdateInvoiceDto;
//# sourceMappingURL=update-invoice.dto.js.map