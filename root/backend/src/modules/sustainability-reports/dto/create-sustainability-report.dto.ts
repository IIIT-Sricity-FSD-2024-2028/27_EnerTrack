import { IsString, IsObject, IsOptional } from "class-validator";

export class CreateSustainabilityReportDto {
  /** Tenant this record belongs to. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;
  @IsString() generated_by_id: string;
  @IsString() title: string;
  @IsString() period: string;
  @IsObject() metrics: Record<string, any>;
  @IsString() generated_at: string;
}
