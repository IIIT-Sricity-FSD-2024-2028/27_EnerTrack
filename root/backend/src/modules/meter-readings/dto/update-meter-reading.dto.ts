import { PartialType } from '@nestjs/mapped-types';
import { CreateMeterReadingDto } from './create-meter-reading.dto';

export class UpdateMeterReadingDto extends PartialType(CreateMeterReadingDto) {}
