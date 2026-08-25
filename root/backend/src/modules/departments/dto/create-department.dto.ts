import { IsString, IsOptional, IsNumber } from "class-validator";

export class CreateDepartmentDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsString() building_id: string;
  @IsString() name: string;
  @IsOptional() @IsNumber() budget?: number;
}
