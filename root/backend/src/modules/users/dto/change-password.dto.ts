import { IsString, Length, Matches } from "class-validator";
import {
  EMAIL,
  EMAIL_MESSAGE,
  LOGIN_PASSWORD,
  LOGIN_PASSWORD_MESSAGE,
  PASSWORD,
  PASSWORD_MESSAGE,
} from "../../../common/patterns";

/** Body for POST /api/users/change-password. */
export class ChangePasswordDto {
  @Length(5, 254) @Matches(EMAIL, { message: `email ${EMAIL_MESSAGE}` }) email: string;
  @IsString() @Matches(LOGIN_PASSWORD, { message: `current_password ${LOGIN_PASSWORD_MESSAGE}` }) current_password: string;
  @Matches(PASSWORD, { message: `new_password ${PASSWORD_MESSAGE}` }) new_password: string;
}
