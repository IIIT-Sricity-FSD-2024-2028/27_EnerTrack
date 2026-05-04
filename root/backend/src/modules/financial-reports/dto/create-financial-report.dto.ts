import { IsString, IsUUID, IsOptional, IsNumber } from 'class-validator';

export class CreateFinancialReportDto {
  @IsUUID() generated_by_id: string;
  @IsOptional() @IsUUID() building_id?: string;
  @IsOptional() @IsUUID() department_id?: string;
  @IsString() title: string;
  @IsString() period: string;
  @IsOptional() @IsString() roi?: string;
  @IsOptional() @IsNumber() npv?: number;
}
