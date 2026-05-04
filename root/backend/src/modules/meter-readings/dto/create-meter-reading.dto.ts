import { IsString, IsUUID, IsNumber } from 'class-validator';

export class CreateMeterReadingDto {
  @IsUUID() meter_id: string;
  @IsNumber() value: number;
  @IsString() unit: string;
  @IsString() timestamp: string;
}
