import { IsString, Length, Matches, ValidateIf } from "class-validator";
import {
  EMAIL,
  EMAIL_MESSAGE,
  LOGIN_PASSWORD,
  LOGIN_PASSWORD_MESSAGE,
  NAME,
  NAME_MESSAGE,
  PHONE,
  PHONE_MESSAGE,
} from "../../../common/patterns";

/**
 * Body for POST /api/users/update-details: a signed-in person changing their
 * own name and phone.
 *
 * The route is public (there are no tokens), so it proves who is asking the
 * same way change-password does: the current password. Role, organisation and
 * email are not here, so the whitelist rejects a body that tries to change
 * them.
 */
export class UpdateDetailsDto {
  @Length(5, 254) @Matches(EMAIL, { message: `email ${EMAIL_MESSAGE}` }) email: string;
  @IsString() @Matches(LOGIN_PASSWORD, { message: `current_password ${LOGIN_PASSWORD_MESSAGE}` }) current_password: string;
  @Length(2, 50) @Matches(NAME, { message: `name ${NAME_MESSAGE}` }) name: string;
  /** Blank means "no phone number". Anything else must be a valid number. */
  @ValidateIf((dto) => dto.phone !== "" && dto.phone !== undefined)
  @Matches(PHONE, { message: `phone ${PHONE_MESSAGE}` })
  phone?: string;
}
