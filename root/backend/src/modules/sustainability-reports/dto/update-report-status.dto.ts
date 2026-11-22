import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const REPORT_STATUSES = ["draft", "submitted", "approved", "published"] as const;

/** Moves a report through sign-off. A note goes with "send back to draft". */
export class UpdateReportStatusDto {
  @IsIn(REPORT_STATUSES as unknown as string[])
  status: (typeof REPORT_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
