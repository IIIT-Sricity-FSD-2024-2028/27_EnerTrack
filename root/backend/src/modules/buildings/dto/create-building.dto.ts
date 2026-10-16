import { IsString, IsOptional, IsNumber, Min } from "class-validator";

export class CreateBuildingDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsString() campus_id: string;
  @IsString() name: string;
  @IsOptional() @IsNumber() @Min(0) budget?: number;
}
