import { IsNumber, IsOptional, Length, Matches, Max, Min } from "class-validator";
import {
  EMAIL,
  EMAIL_DOMAIN,
  EMAIL_DOMAIN_MESSAGE,
  EMAIL_MESSAGE,
  LABEL,
  LABEL_MESSAGE,
  LOCATION,
  LOCATION_MESSAGE,
  NAME,
  NAME_MESSAGE,
  ORG_NAME,
  ORG_NAME_MESSAGE,
  PASSWORD,
  PASSWORD_MESSAGE,
  PHONE,
  PHONE_MESSAGE,
} from "../../../common/patterns";

/**
 * Body for POST /api/organizations/register: an organisation signing itself
 * up, which is where the whole engagement begins.
 *
 * It carries two records because they are inseparable: an organisation with
 * nobody in it cannot request an audit, log in, or be sent a proposal, and a
 * user with no organisation belongs to no tenant and would see nothing at
 * all. Creating one without the other produces a dead record either way, so
 * the API takes them together.
 *
 * The person signing it up becomes its Organization Admin: the one who then
 * creates every other account. Note what is NOT here: status, tier, tariff,
 * data source. A prospect has none of those yet; they are what the audit is
 * for.
 */
export class RegisterOrganizationDto {
  /* -- The organisation ------------------------------------------- */
  @Matches(ORG_NAME, { message: `name ${ORG_NAME_MESSAGE}` }) name: string;
  @Matches(LABEL, { message: `type ${LABEL_MESSAGE}` }) type: string;
  @IsOptional() @Matches(LOCATION, { message: `location ${LOCATION_MESSAGE}` }) location?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(100000000) floor_area_sqm?: number;
  /** Mail domain for every account the organisation will issue, e.g. iiits.in. */
  @IsOptional() @Matches(EMAIL_DOMAIN, { message: `email_domain ${EMAIL_DOMAIN_MESSAGE}` }) email_domain?: string;

  /* -- The person signing it up, who becomes its Organization Admin -- */
  @Length(2, 50) @Matches(NAME, { message: `admin_name ${NAME_MESSAGE}` }) admin_name: string;
  @Length(5, 254) @Matches(EMAIL, { message: `admin_email ${EMAIL_MESSAGE}` }) admin_email: string;
  @Matches(PASSWORD, { message: `admin_password ${PASSWORD_MESSAGE}` }) admin_password: string;
  @IsOptional() @Matches(PHONE, { message: `admin_phone ${PHONE_MESSAGE}` }) admin_phone?: string;
}
