import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";

/**
 * Body for POST /api/organizations/register — an organisation signing itself
 * up, which is where the whole engagement begins.
 *
 * It carries two records because they are inseparable: an organisation with
 * nobody in it cannot request an audit, log in, or be sent a proposal, and a
 * user with no organisation belongs to no tenant and would see nothing at
 * all. Creating one without the other produces a dead record either way, so
 * the API takes them together.
 *
 * Note what is NOT here: status, tier, tariff, data source. A prospect has
 * none of those yet — they are what the audit is for.
 */
export class RegisterOrganizationDto {
  /* ── The organisation ─────────────────────────────────────────── */
  @IsString() @MinLength(3) name: string;
  @IsString() @MinLength(2) type: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsNumber() @Min(0) floor_area_sqm?: number;

  /* ── The person signing it up, who becomes its Organization Admin ── */
  @IsString() @MinLength(2) admin_name: string;
  @IsEmail() admin_email: string;
  @IsString() @MinLength(6) admin_password: string;
  @IsOptional() @IsString() admin_phone?: string;
}
