import { IsString, IsUUID, IsOptional, IsNumber } from "class-validator";

export class CreateBuildingDto {
  @IsUUID() campus_id: string;
  @IsString() name: string;
  @IsOptional() @IsNumber() budget?: number;
}
