import { IsString, Length, Matches } from "class-validator";
import {
  EMAIL,
  EMAIL_MESSAGE,
  LOGIN_PASSWORD,
  LOGIN_PASSWORD_MESSAGE,
} from "../../../common/patterns";

/** Body for POST /api/users/delete-account: a person deleting their own account. */
export class DeleteAccountDto {
  @Length(5, 254) @Matches(EMAIL, { message: `email ${EMAIL_MESSAGE}` }) email: string;
  @IsString() @Matches(LOGIN_PASSWORD, { message: `password ${LOGIN_PASSWORD_MESSAGE}` }) password: string;
}
