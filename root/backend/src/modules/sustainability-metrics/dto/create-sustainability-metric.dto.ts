import { IsString, IsNumber, IsOptional } from "class-validator";

export class CreateSustainabilityMetricDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsString() period: string;
  @IsNumber() energy_consumed: number;
  @IsNumber() water_usage: number;
  @IsNumber() emissions: number;
}
