import { IsOptional, Matches } from "class-validator";

/** The coordinator's priority for one issue. null goes back to the system's own level. */
export class SetPriorityDto {
  @IsOptional()
  @Matches(/^(low|medium|high|immediate)$/i, {
    message: "level must be one of: low, medium, high, immediate (or null for the system level)",
  })
  level?: string | null;
}
