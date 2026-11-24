import { IsNumber, Min } from "class-validator";

export class UpdateExpenseSettingsDto {
  /** Cumulative per-Work-Order cap in ₹. Set to 0 to disable auto-approval. */
  @IsNumber()
  @Min(0)
  auto_approve_cap: number;
}
