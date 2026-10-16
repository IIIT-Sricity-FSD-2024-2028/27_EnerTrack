import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Body for approving or denying an audit request.
 *
 * A note is optional and mainly for a denial, where the person who asked
 * will want to know why. `decided_by` is still accepted so older clients do
 * not fail validation, but it is ignored: the controller records the
 * signed-in caller instead.
 */
export class DecideAuditRequestDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() decided_by?: string;
}
