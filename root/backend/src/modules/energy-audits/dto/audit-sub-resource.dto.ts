import {
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import {
  FindingSeverity,
  FindingStatus,
} from "../../../core/database/database.service";

/** Body for PATCH /energy-audits/:id/survey. */
export class UpdateSurveyDto {
  @IsOptional() @IsString() data_source_tier?: string;
  @IsOptional() @IsNumber() @Min(0) floor_area_sqm?: number;
  @IsOptional() @IsString() notes?: string;
}

/** Body for POST /energy-audits/:id/findings. */
export class CreateFindingDto {
  @IsString() title: string;
  @IsString() category: string;
  @IsEnum(FindingSeverity) severity: FindingSeverity;

  @IsNumber() @Min(0) est_annual_saving: number;
  @IsNumber() @Min(0) capex: number;
  /** Derived from capex and saving when omitted. */
  @IsOptional() @IsNumber() @Min(0) payback_months?: number;

  @IsOptional() @IsEnum(FindingStatus) status?: FindingStatus;

  /** Buildings the measure touches. */
  @IsArray() @IsString({ each: true }) building_ids: string[];
}

/** Body for PATCH /energy-audits/:id/findings/:findingId. */
export class UpdateFindingDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsEnum(FindingSeverity) severity?: FindingSeverity;
  @IsOptional() @IsNumber() @Min(0) est_annual_saving?: number;
  @IsOptional() @IsNumber() @Min(0) capex?: number;
  @IsOptional() @IsNumber() @Min(0) payback_months?: number;
  @IsOptional() @IsEnum(FindingStatus) status?: FindingStatus;

  /**
   * When the client's team completed the work. The service stamps this
   * automatically the first time status becomes IMPLEMENTED, so it only
   * needs sending to correct a date.
   */
  @IsOptional() @IsISO8601() implemented_on?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) building_ids?: string[];
}

/** Body for POST /energy-audits/:id/proposal. */
export class SendProposalDto {
  @IsString() recommended_plan_id: string;

  /**
   * Headcount and campuses as counted during the survey. The quote is built
   * from these; the first invoice bills whatever the numbers actually are on
   * the day, which is why both are recorded rather than inferred.
   */
  @IsInt() @Min(0) estimated_staff: number;
  @IsInt() @Min(0) estimated_campuses: number;
}

/** Body for the client's answer — a change request or a decline. */
export class RespondToProposalDto {
  @IsString() response_note: string;
}
