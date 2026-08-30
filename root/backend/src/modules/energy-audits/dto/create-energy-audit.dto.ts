import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { AuditStatus } from "../../../core/database/database.service";

/**
 * Nested shapes (survey, baseline, findings, verifications) are validated
 * loosely here, the same way Alert.messages and Initiative.outcomes
 * already are in this codebase. They are not filled in by hand through
 * this DTO in practice: the survey and baseline arrive via
 * PATCH /:id/baseline, and findings and verifications through their own
 * sub-routes, which validate the fields that matter.
 */
export class CreateEnergyAuditDto {
  /** Tenant being audited. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;

  @IsString() auditor_id: string;
  @IsEnum(AuditStatus) status: AuditStatus;

  @IsOptional() @IsISO8601() scheduled_on?: string;
  @IsOptional() @IsISO8601() conducted_on?: string;
  @IsOptional() @IsISO8601() approved_on?: string;

  @IsOptional() @IsObject() survey?: Record<string, any>;
  @IsOptional() @IsObject() baseline?: Record<string, any>;
  @IsOptional() @IsArray() findings?: any[];
  @IsOptional() @IsArray() verifications?: any[];

  @IsOptional() @IsString() recommended_plan_id?: string;
  @IsOptional() @IsNumber() @Min(0) projected_annual_saving?: number;
  @IsOptional() @IsString() summary?: string;
}
