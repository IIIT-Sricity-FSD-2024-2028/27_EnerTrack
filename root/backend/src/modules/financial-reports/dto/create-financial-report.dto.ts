import { IsString, IsUUID, IsOptional, IsNumber, IsBoolean } from "class-validator";

export class CreateFinancialReportDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsOptional() @IsUUID() generated_by_id?: string;
  @IsOptional() @IsUUID() building_id?: string;
  @IsOptional() @IsUUID() department_id?: string;
  @IsString() title: string;
  @IsString() period: string;
  @IsOptional() @IsString() roi?: string;
  @IsOptional() @IsNumber() npv?: number;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() format?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() scope?: string;
  @IsOptional() @IsString() scope_label?: string;
  @IsOptional() @IsNumber() payback_years?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() archived?: boolean;
}
