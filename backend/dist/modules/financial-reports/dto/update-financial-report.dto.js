"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateFinancialReportDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_financial_report_dto_1 = require("./create-financial-report.dto");
class UpdateFinancialReportDto extends (0, mapped_types_1.PartialType)(create_financial_report_dto_1.CreateFinancialReportDto) {
}
exports.UpdateFinancialReportDto = UpdateFinancialReportDto;
//# sourceMappingURL=update-financial-report.dto.js.map