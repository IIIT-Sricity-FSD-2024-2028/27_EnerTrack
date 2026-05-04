import { PartialType } from '@nestjs/mapped-types';
import { CreateMeterDto } from './create-meter.dto';

export class UpdateMeterDto extends PartialType(CreateMeterDto) {}
