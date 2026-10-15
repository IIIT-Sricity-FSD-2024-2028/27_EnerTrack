import { IsString, IsOptional, IsEnum, Length, Matches } from "class-validator";
import { UserRole } from "../../../core/database/database.service";
import {
  EMAIL,
  EMAIL_MESSAGE,
  LABEL,
  LABEL_MESSAGE,
  NAME,
  NAME_MESSAGE,
  PASSWORD,
  PASSWORD_MESSAGE,
  PHONE,
  PHONE_MESSAGE,
} from "../../../common/patterns";

export class CreateUserDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @Length(2, 50) @Matches(NAME, { message: `name ${NAME_MESSAGE}` }) name: string;
  @Length(5, 254) @Matches(EMAIL, { message: `email ${EMAIL_MESSAGE}` }) email: string;
  @IsOptional() @Matches(PHONE, { message: `phone ${PHONE_MESSAGE}` }) phone?: string;
  @Matches(PASSWORD, { message: `password ${PASSWORD_MESSAGE}` }) password: string;
  @IsEnum(UserRole) role: UserRole;
  @IsOptional() @Matches(LABEL, { message: `specialization ${LABEL_MESSAGE}` }) specialization?: string;
}
