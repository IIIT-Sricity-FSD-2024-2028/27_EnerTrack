import { IsOptional, IsString, IsNotEmpty } from "class-validator";

/**
 * Only the title of a saved report can be edited in place. The figures are
 * a snapshot of the readings for its period; to change the period, use PUT,
 * which regenerates the whole snapshot.
 */
export class UpdateSustainabilityReportDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
}
