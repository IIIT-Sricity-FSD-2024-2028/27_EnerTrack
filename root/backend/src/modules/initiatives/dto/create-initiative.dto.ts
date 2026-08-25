import { IsString, IsOptional, IsEnum, IsBoolean, IsArray } from "class-validator";
import { InitiativeStatus } from "../../../core/database/database.service";

export class CreateInitiativeDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsString() created_by_id: string;
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(InitiativeStatus) status: InitiativeStatus;
  @IsBoolean() feasible: boolean;
  @IsOptional() @IsBoolean() onTrack?: boolean;
  @IsString() target_reduction: string;
  @IsOptional() @IsArray() outcomes?: string[];
}
