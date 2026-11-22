import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { TargetMetric } from "../../../core/database/database.service";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * A proposed target. Status, author and approval are set by the server: a
 * new target always starts as "proposed" and only the Organization Admin can
 * make it active.
 */
export class CreateTargetDto {
  @IsEnum(TargetMetric)
  metric: TargetMetric;

  /** "YYYY-MM" */
  @Matches(MONTH, { message: "baseline_from must be YYYY-MM" })
  baseline_from: string;

  /** "YYYY-MM" */
  @Matches(MONTH, { message: "baseline_to must be YYYY-MM" })
  baseline_to: string;

  /** Percentage below the baseline, e.g. 10. */
  @IsNumber()
  @Min(0.1)
  @Max(100)
  reduction_pct: number;

  /** "YYYY-MM": the last month that counts. */
  @Matches(MONTH, { message: "deadline must be YYYY-MM" })
  deadline: string;

  /** Leave empty (or out) for the whole organisation. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  building_ids?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
