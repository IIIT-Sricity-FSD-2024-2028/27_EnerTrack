import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

/**
 * A price tier. Note the absence of organization_id: the catalogue is
 * global, identical for every tenant.
 */
export class CreateSubscriptionPlanDto {
  @IsString() name: string;
  @IsString() tagline: string;

  @IsNumber() @Min(0) price_per_meter_month: number;
  @IsNumber() @Min(0) min_monthly_fee: number;

  @IsNumber() @Min(0) audit_fee_base: number;
  @IsNumber() @Min(0) audit_fee_per_sqm: number;

  /** Percentage of verified savings EnerTrack invoices. */
  @IsNumber() @Min(0) performance_share_pct: number;

  /** Ceiling on that share, as a percentage of the subscription fee. */
  @IsNumber() @Min(0) share_cap_pct_of_subscription: number;

  @IsArray() @IsString({ each: true }) features: string[];
  @IsOptional() @IsBoolean() is_active?: boolean;
}
