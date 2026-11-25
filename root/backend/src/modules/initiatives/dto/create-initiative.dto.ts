import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsIn,
  IsObject,
  IsNumber,
  Min,
  Matches,
} from "class-validator";
import { InitiativeStatus, TargetMetric } from "../../../core/database/database.service";
import { TEAMS } from "../../issue-catalogue/issue-catalogue";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class CreateInitiativeDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  // created_by_id is not accepted: the server records the signed-in user.
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  /** Optional; a new initiative is always "proposed" (anything else is 400). */
  @IsOptional() @IsEnum(InitiativeStatus) status?: InitiativeStatus;
  @IsBoolean() feasible: boolean;
  // "onTrack" is no longer accepted: whether an initiative is on track is
  // measured from meter readings (GET /initiatives/:id/performance).
  /** Free-text target, kept for older initiatives; use metric + expected_saving. */
  @IsOptional() @IsString() target_reduction?: string;
  @IsOptional() @IsArray() outcomes?: string[];
  /** Up-front capital cost. */
  @IsOptional() @IsNumber() @Min(0) capex?: number;
  /** YYYY-MM-DD */
  @IsOptional() @Matches(DATE, { message: "start_date must be YYYY-MM-DD" }) start_date?: string;
  /** YYYY-MM-DD */
  @IsOptional() @Matches(DATE, { message: "target_date must be YYYY-MM-DD" }) target_date?: string;

  // ── Measurement ──
  /** What it saves: energy_kwh, water_kl, gas_m3 or emissions_kg. */
  @IsOptional() @IsEnum(TargetMetric) metric?: TargetMetric;
  /** Expected saving per year, in the metric's unit. */
  @IsOptional() @IsNumber() @Min(0) expected_saving?: number;
  /** Buildings it covers; empty means the whole organisation. */
  @IsOptional() @IsArray() @IsString({ each: true }) building_ids?: string[];
  /** Specific meters, when narrower than whole buildings. */
  @IsOptional() @IsArray() @IsString({ each: true }) meter_ids?: string[];
  /** The target it contributes to. */
  @IsOptional() @IsString() target_id?: string;

  // ── On-site work ──
  /** Does it need technicians on site? If true, teams and target_date are required. */
  @IsOptional() @IsBoolean() onsite_work?: boolean;
  /** Technician types needed: electrician, plumber, general, hvac. Approval sends one job to each, in parallel. */
  @IsOptional() @IsArray() @IsIn(TEAMS, { each: true }) teams?: string[];
  /** What each type has to do, by team, e.g. { plumber: "Fit the tank…" }. Required for every type in teams. */
  @IsOptional() @IsObject() team_tasks?: Record<string, string>;
}
