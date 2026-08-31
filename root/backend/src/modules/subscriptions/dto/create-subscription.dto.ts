import { IsEnum, IsISO8601, IsOptional, IsString } from "class-validator";
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
}
