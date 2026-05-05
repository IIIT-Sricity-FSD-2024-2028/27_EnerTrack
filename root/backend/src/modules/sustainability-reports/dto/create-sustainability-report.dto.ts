import { IsString, IsObject } from "class-validator";

export class CreateSustainabilityReportDto {
  @IsString() generated_by_id: string;
  @IsString() title: string;
  @IsString() period: string;
  @IsObject() metrics: Record<string, any>;
  @IsString() generated_at: string;
}
