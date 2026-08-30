import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import {
  BillingCycle,
  SubscriptionStatus,
} from "../../../core/database/database.service";

export class CreateSubscriptionDto {
  /** Tenant this contract belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;

  @IsString() plan_id: string;

  @IsEnum(SubscriptionStatus) status: SubscriptionStatus;
  @IsEnum(BillingCycle) billing_cycle: BillingCycle;

  @IsOptional() @IsISO8601() started_on?: string;
  @IsOptional() @IsISO8601() renews_on?: string;
  @IsOptional() @IsISO8601() cancelled_on?: string;

  /** Negotiated share percentage. Falls back to the plan's when omitted. */
  @IsOptional() @IsNumber() @Min(0) performance_share_pct_override?: number;

  /** Set when the audit fee was waived on signature. */
  @IsOptional() @IsISO8601() audit_fee_waived_on?: string;

  @IsOptional() @IsString() account_officer_id?: string;

  /** Audit whose locked baseline this contract measures savings against. */
  @IsOptional() @IsString() baseline_audit_id?: string;
}
