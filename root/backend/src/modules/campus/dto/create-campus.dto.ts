import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateCampusDto {
  @IsString() name: string;
  @IsOptional() @IsString() location?: string;
  @IsNumber() total_budget: number;
}
