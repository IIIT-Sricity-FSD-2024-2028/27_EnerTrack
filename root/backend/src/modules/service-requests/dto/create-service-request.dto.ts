import { IsString, IsUUID, IsOptional, Matches } from "class-validator";

export class CreateServiceRequestDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsUUID() reporter_id: string;
  @IsOptional() @IsUUID() assigned_to_id?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() issue_type?: string;
  /** Required, and not just spaces: a report with nothing in it is useless. */
  @IsString() @Matches(/\S/, { message: "description must not be empty" }) description: string;
  @IsOptional() @Matches(/^(low|medium|high)$/i, { message: "priority must be one of: low, medium, high" }) priority?: string;
  @IsOptional() @IsString() status?: string;
}
