import { IsString, IsUUID, IsObject } from "class-validator";

export class CreateSustainabilityReportDto {
  @IsUUID() generated_by_id: string;
  @IsString() title: string;
  @IsString() period: string;
  @IsObject() metrics: Record<string, any>;
  @IsString() generated_at: string;
}
