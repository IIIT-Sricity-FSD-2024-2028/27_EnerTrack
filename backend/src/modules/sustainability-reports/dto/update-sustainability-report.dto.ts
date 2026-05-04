import { PartialType } from '@nestjs/mapped-types';
import { CreateSustainabilityReportDto } from './create-sustainability-report.dto';

export class UpdateSustainabilityReportDto extends PartialType(CreateSustainabilityReportDto) {}
