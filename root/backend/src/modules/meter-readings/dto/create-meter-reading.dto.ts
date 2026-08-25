import { IsString, IsUUID, IsNumber, IsOptional } from "class-validator";

export class CreateMeterReadingDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsUUID() meter_id: string;
  @IsNumber() value: number;
  @IsString() unit: string;
  @IsString() timestamp: string;
}
