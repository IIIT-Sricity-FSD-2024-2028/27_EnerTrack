import { PartialType } from '@nestjs/mapped-types';
import { CreateWastageReportDto } from './create-wastage-report.dto';

export class UpdateWastageReportDto extends PartialType(CreateWastageReportDto) {}
