import { IsString, IsOptional, IsNotEmpty } from "class-validator";

export class GenerateSustainabilityReportDto {
  @IsNotEmpty()
  @IsString()
  period: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  title?: string;
}
