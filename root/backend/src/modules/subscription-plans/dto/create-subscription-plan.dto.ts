import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

/**
 * A tier. Note the absence of organization_id: the catalogue is global,
 * identical for every tenant.
 */
export class CreateSubscriptionPlanDto {
  @IsString() name: string;
  @IsString() tagline: string;

  /** Flat fee covering everything up to the included allowances. */
  @IsNumber() @Min(0) base_monthly_fee: number;

  /** Staff accounts included before overage starts. */
  @IsInt() @Min(0) included_seats: number;

  /** Charged per staff account beyond included_seats. */
  @IsNumber() @Min(0) price_per_extra_seat: number;

  /** Hard limit on campuses. Omit or send null for unlimited. */
  @IsOptional() @IsInt() @Min(1) max_campuses?: number | null;

  @IsArray() @IsString({ each: true }) features: string[];
  @IsOptional() @IsBoolean() is_active?: boolean;
}
