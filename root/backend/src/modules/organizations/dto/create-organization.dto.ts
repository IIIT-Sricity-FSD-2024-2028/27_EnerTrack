import { IsOptional, IsNumber, IsEnum, IsString, Matches, Max, Min } from "class-validator";
import { OrganizationStatus } from "../../../core/database/database.service";
import {
  EMAIL_DOMAIN,
  EMAIL_DOMAIN_MESSAGE,
  LABEL,
  LABEL_MESSAGE,
  LOCATION,
  LOCATION_MESSAGE,
  ORG_NAME,
  ORG_NAME_MESSAGE,
} from "../../../common/patterns";

export class CreateOrganizationDto {
  @Matches(ORG_NAME, { message: `name ${ORG_NAME_MESSAGE}` }) name: string;
  @Matches(LABEL, { message: `type ${LABEL_MESSAGE}` }) type: string;
  @IsOptional() @Matches(LOCATION, { message: `location ${LOCATION_MESSAGE}` }) location?: string;
  @IsEnum(OrganizationStatus) status: OrganizationStatus;
  @IsOptional() @IsNumber() @Min(1) @Max(100000000) floor_area_sqm?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000) tariff_rate?: number;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "contract_start must be a YYYY-MM-DD date" }) contract_start?: string;
  /** Mail domain every account in this organisation must use, e.g. iiits.in. */
  @IsOptional() @Matches(EMAIL_DOMAIN, { message: `email_domain ${EMAIL_DOMAIN_MESSAGE}` }) email_domain?: string;
}
