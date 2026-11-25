import { IsIn, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateFoodWasteLogDto {
  /** Where the food was thrown away, e.g. "North Campus Cafeteria". */
  @IsString() @MinLength(2) @MaxLength(100) location: string;
  @IsOptional() @IsString() building_id?: string;
  /** The day the waste was collected (YYYY-MM-DD). Defaults to today. */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "date must be YYYY-MM-DD" }) date?: string;
  @IsNumber() @Min(0.1) @Max(2000) kg: number;
  @IsOptional() @IsIn(["breakfast", "lunch", "dinner", "other"]) meal?: "breakfast" | "lunch" | "dinner" | "other";
}
