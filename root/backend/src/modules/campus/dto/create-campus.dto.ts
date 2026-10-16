import { IsString, IsOptional, IsNumber, Min } from "class-validator";

export class CreateCampusDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsString() name: string;
  @IsOptional() @IsString() location?: string;
  @IsNumber() @Min(0) total_budget: number;
}
