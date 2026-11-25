import { IsBoolean, IsIn, IsISO8601, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { DeclineReason } from "../../../core/database/database.service";

export class DeclineJobDto {
  @IsIn(["sick", "on_another_job", "no_tools", "other"]) reason: DeclineReason;
}

export class AvailabilityDto {
  @IsBoolean() available: boolean;
}

export class ManualAssignDto {
  @IsString() user_id: string;
}

export class NeedsPartsDto {
  @IsOptional() @IsInt() @Min(1) @Max(60) days?: number;
}

export class ExtensionRequestDto {
  @IsISO8601() new_deadline_at: string;
  @IsString() reason: string;
}

export class DecideDto {
  @IsBoolean() approve: boolean;
}

export class SetDeadlineDto {
  @IsISO8601() deadline_at: string;
}

export class FinishJobDto {
  /** What was done, for the coordinator who verifies the job. */
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class SendFaultDto {
  @IsOptional() @IsIn(["scheduled", "immediate"]) kind?: "scheduled" | "immediate";
  /** Leave out to use the fault's severity. */
  @IsOptional() @IsIn(["low", "medium", "high", "immediate"]) priority?: string;
  /** Leave out to let the system pick the technician. */
  @IsOptional() @IsString() assignee_id?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

/**
 * The coordinator's answer to a rework request on an initiative job:
 * "same" (the technician who did it), "auto" (the system picks), "pick"
 * (assignee_id) — each with finish_by — or "decline" with a note.
 */
export class DecideReworkDto {
  @IsIn(["same", "auto", "pick", "decline"]) decision: "same" | "auto" | "pick" | "decline";
  @IsOptional() @IsString() assignee_id?: string;
  /** YYYY-MM-DD, today or later. Required unless declining. */
  @IsOptional() @IsString() finish_by?: string;
  /** Required when declining (sent to the officer); optional otherwise. */
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
