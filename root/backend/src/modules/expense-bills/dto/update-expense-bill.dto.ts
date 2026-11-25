import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import {
  ExpenseBillStatus,
  ExpenseCategory,
} from "../../../core/database/database.service";

export class UpdateExpenseBillDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160)
  title?: string;

  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  vendor?: string;

  @IsOptional() @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "bill_date must be YYYY-MM-DD" })
  bill_date?: string;

  @IsOptional() @IsString() @MaxLength(60)
  bill_number?: string;

  @IsOptional() @IsNumber() @IsPositive()
  amount?: number;

  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;

  @IsOptional() @IsEnum(ExpenseBillStatus)
  status?: ExpenseBillStatus;

  @IsOptional() @IsString() @MaxLength(1000)
  rejection_reason?: string;
}
