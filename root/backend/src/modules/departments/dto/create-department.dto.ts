import { IsString, IsUUID, IsOptional, IsNumber } from "class-validator";

export class CreateDepartmentDto {
  @IsUUID() building_id: string;
  @IsString() name: string;
  @IsOptional() @IsNumber() budget?: number;
}
