import { Length, Matches } from "class-validator";
import {
  EMAIL,
  EMAIL_MESSAGE,
  NAME,
  NAME_MESSAGE,
  PASSWORD,
  PASSWORD_MESSAGE,
  PHONE,
  PHONE_MESSAGE,
} from "../../../common/patterns";

/**
 * Body for POST /api/users/signup: a student or faculty member creating their
 * own Campus Visitor account.
 *
 * Note what is NOT here: role and organization_id. The role is always Campus
 * Visitor and the organisation comes from the email domain, so the whitelist
 * rejects a body that tries to choose either.
 */
export class SignupDto {
  @Length(2, 50) @Matches(NAME, { message: `name ${NAME_MESSAGE}` }) name: string;
  @Length(5, 254) @Matches(EMAIL, { message: `email ${EMAIL_MESSAGE}` }) email: string;
  @Matches(PHONE, { message: `phone ${PHONE_MESSAGE}` }) phone: string;
  @Matches(PASSWORD, { message: `password ${PASSWORD_MESSAGE}` }) password: string;
}
