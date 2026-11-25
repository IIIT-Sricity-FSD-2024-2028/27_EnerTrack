import { IsString, IsOptional, IsEnum, IsIn, Length, Matches } from "class-validator";
import { TEAMS } from "../../issue-catalogue/issue-catalogue";
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
  /** Field-staff trade. Jobs are only auto-assigned to someone on the matching team; null means none. */
  @IsOptional() @IsIn(TEAMS, { message: `team must be one of: ${TEAMS.join(", ")}` }) team?: string | null;
}
