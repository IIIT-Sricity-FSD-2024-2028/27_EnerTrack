import { IsString, IsOptional, IsEnum, IsArray } from "class-validator";
import { AlertStatus } from "../../../core/database/database.service";

export class CreateAlertDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  // Plain strings: this system's ids are not all UUIDs (e.g. seeded meters
  // are "mmmm0000-…"). The service checks the meter exists in the caller's
  // organisation, which is the check that matters.
  @IsString() meter_id: string;
  @IsOptional() @IsString() triggering_reading_id?: string;
  @IsString() title: string;
  @IsString() severity: string;
  @IsEnum(AlertStatus) status: AlertStatus;
  @IsOptional() @IsArray() messages?: any[];
}
