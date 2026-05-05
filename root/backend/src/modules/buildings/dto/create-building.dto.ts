import { IsString, IsOptional, IsNumber } from "class-validator";

export class CreateBuildingDto {
  @IsString() campus_id: string;
  @IsString() name: string;
  @IsOptional() @IsNumber() budget?: number;
}
