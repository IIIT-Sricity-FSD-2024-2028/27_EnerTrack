import { IsString, IsOptional, IsNumber } from "class-validator";

export class CreateCampusDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsString() name: string;
  @IsOptional() @IsString() location?: string;
  @IsNumber() total_budget: number;
}
