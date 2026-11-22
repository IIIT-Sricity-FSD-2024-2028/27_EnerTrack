import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

/** The coordinator's decision on an alert, in one step. */
export class DecideAlertDto {
  @IsIn(["fault", "monitor", "false_alarm"]) decision: "fault" | "monitor" | "false_alarm";
  /** What was found or why, for the alert log. */
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  /** Required when sending it on as a fault. */
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) asset?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) fault_type?: string;
}
