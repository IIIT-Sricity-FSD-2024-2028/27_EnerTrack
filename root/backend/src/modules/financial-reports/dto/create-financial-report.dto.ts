import { IsString, IsUUID, IsOptional, IsNumber } from "class-validator";

export class CreateFinancialReportDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsUUID() generated_by_id: string;
  @IsOptional() @IsUUID() building_id?: string;
  @IsOptional() @IsUUID() department_id?: string;
  @IsString() title: string;
  @IsString() period: string;
  @IsOptional() @IsString() roi?: string;
  @IsOptional() @IsNumber() npv?: number;
}
