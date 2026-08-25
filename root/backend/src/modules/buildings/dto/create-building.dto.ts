import { IsString, IsOptional, IsNumber } from "class-validator";

export class CreateBuildingDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsString() campus_id: string;
  @IsString() name: string;
  @IsOptional() @IsNumber() budget?: number;
}
