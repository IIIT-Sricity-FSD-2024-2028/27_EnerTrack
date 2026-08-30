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
import {
  FindingSeverity,
  FindingStatus,
} from "../../../core/database/database.service";

/** Body for PATCH /energy-audits/:id/baseline — locks the measured window. */
export class LockBaselineDto {
  /** "YYYY-MM" bounds of the window the baseline was measured over. */
  @IsString() period_from: string;
  @IsString() period_to: string;

  @IsNumber() @Min(0) baseline_kwh: number;
  @IsOptional() @IsNumber() @Min(0) baseline_water_kl?: number;
  @IsOptional() @IsNumber() @Min(0) baseline_cost?: number;
  @IsOptional() @IsNumber() @Min(0) baseline_co2_kg?: number;

  /**
   * Weather, occupancy and floor area averaged across the same window.
   * Without these there is nothing to normalise a later period against,
   * so the baseline cannot be locked with them missing.
   */
  @IsObject() factors: {
    cooling_degree_days: number;
    occupancy_index: number;
    floor_area_sqm: number;
  };

  @IsString() locked_by: string;
}

/** Body for PATCH /energy-audits/:id/survey. */
export class UpdateSurveyDto {
  @IsOptional() @IsNumber() @Min(0) buildings_surveyed?: number;
  @IsOptional() @IsNumber() @Min(0) meters_found?: number;
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
  @IsOptional() @IsNumber() @Min(0) payback_months?: number;

  @IsOptional() @IsEnum(FindingStatus) status?: FindingStatus;

  /**
   * Buildings the measure touches. This is what scopes the meters a later
   * verification may credit, so a finding with an empty list can never
   * contribute to a bill.
   */
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
   * When the client's team actually completed the work. The service sets
   * this automatically the first time status becomes IMPLEMENTED, so it
   * only needs sending to correct a date.
   */
  @IsOptional() @IsISO8601() implemented_on?: string;

  @IsOptional() @IsArray() @IsString({ each: true }) building_ids?: string[];
}

/** Body for POST /energy-audits/:id/verifications. */
export class CreateVerificationDto {
  /** "YYYY-MM" the savings are claimed for. */
  @IsString() period: string;

  /**
   * Everything else is recomputed server-side from the locked baseline and
   * the period's readings. Nothing about a claim is taken on trust from
   * the client that benefits from it.
   */
  @IsOptional() @IsString() note?: string;
}

/** Body for PATCH /energy-audits/:id/verifications/:vid/dispute. */
export class DisputeVerificationDto {
  @IsString() dispute_reason: string;
}
