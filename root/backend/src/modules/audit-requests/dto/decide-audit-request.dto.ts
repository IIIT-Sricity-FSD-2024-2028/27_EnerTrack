import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Body for approving or denying an audit request.
 *
 * Both fields are optional. A note is mainly for a denial, where the person
 * who asked will want to know why; `decided_by` is the auditor's user id, kept
 * on the request as a record of who made the call.
 */
export class DecideAuditRequestDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsString() decided_by?: string;
}
