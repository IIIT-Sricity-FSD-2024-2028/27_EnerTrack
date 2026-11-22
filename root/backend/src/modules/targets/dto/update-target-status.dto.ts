import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { TargetStatus } from "../../../core/database/database.service";

/** The Organization Admin's decision on a target, or a manual close. */
export class UpdateTargetStatusDto {
  @IsEnum(TargetStatus)
  status: TargetStatus;

  /** Why, shown to the person who proposed it (e.g. the reason for rejecting). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
