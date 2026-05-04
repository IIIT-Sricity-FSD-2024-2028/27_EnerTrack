import { IsString, IsNumber } from "class-validator";

export class CreateSustainabilityMetricDto {
  @IsString() period: string;
  @IsNumber() energy_consumed: number;
  @IsNumber() water_usage: number;
  @IsNumber() emissions: number;
}
