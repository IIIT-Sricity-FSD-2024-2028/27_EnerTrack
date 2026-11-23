import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

/**
 * What a student sends to report an issue. Only answers: the server works out
 * priority, size, team and duplicates, and takes the reporter from the login.
 * Whitelisting is strict, so sending `priority`, `reporter_id` or `team` is a
 * 400, not silently ignored.
 */
export class CreateIssueReportDto {
  @IsString() building_id: string;
  @IsString() @MaxLength(30) floor: string;
  @IsString() area: string;
  /** Room number, dropdown choice or machine number. */
  @IsOptional() @IsString() @MaxLength(60) part?: string;
  @IsString() item_id: string;
  /** Needed for "Other", so the server knows which team's list the student was in. */
  @IsOptional() @IsString() issue_type_id?: string;
  @IsOptional() @IsString() problem_id?: string;
  @IsOptional() @IsIn(["one", "some", "all"]) how_many?: string;
  @IsOptional() @IsObject() answers?: Record<string, string>;
  @IsOptional() @IsBoolean() in_danger?: boolean;
  @IsOptional() @IsBoolean() happened_before?: boolean;
  @IsOptional() @IsIn(["hour", "hours", "day"]) since?: string;
  /** "Other" only: how bad is it. */
  @IsOptional() @IsString() how_bad?: string;
  /** "Other" only: the few words the student typed. */
  @IsOptional() @IsString() @MaxLength(60) other_text?: string;
  /** Optional free text. Never changes priority, size, team or the duplicate result. */
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  /**
   * Answer to "Is this the same problem?" when an open whole-floor or
   * whole-building ticket already covers the spot: that ticket's id to join
   * it, or "new" to start a separate ticket.
   */
  @IsOptional() @IsString() same_as?: string;
}
