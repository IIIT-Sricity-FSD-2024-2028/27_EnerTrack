import { IsString, IsOptional, IsNumber } from "class-validator";

export class CreateDepartmentDto {
  @IsString() building_id: string;
  @IsString() name: string;
  @IsOptional() @IsNumber() budget?: number;
}
