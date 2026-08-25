import { IsString, IsEmail, IsOptional, MinLength, IsEnum } from "class-validator";
import { UserRole } from "../../../core/database/database.service";

export class CreateUserDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() @MinLength(6) password: string;
  @IsEnum(UserRole) role: UserRole;
  @IsOptional() @IsString() specialization?: string;
}
