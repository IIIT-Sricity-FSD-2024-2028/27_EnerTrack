import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";
import { AuditStatus } from "../../../core/database/database.service";

/**
 * Survey and findings are validated loosely here, the same way
 * Alert.messages and Initiative.outcomes already are in this codebase.
 * In practice neither is filled in through this DTO: the survey arrives
 * via PATCH /:id/survey and findings through their own sub-routes, which
 * validate the fields that matter.
 */
export class CreateEnergyAuditDto {
  /** Tenant being audited. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;

  @IsString() auditor_id: string;
  @IsEnum(AuditStatus) status: AuditStatus;

  @IsOptional() @IsISO8601() scheduled_on?: string;
  @IsOptional() @IsISO8601() conducted_on?: string;

  @IsOptional() @IsObject() survey?: Record<string, any>;
  @IsOptional() @IsArray() findings?: any[];

  @IsOptional() @IsString() summary?: string;
}
