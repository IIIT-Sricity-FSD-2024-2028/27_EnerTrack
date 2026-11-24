import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { ExpenseCategory } from "../../../core/database/database.service";

export class CreateExpenseBillDto {
  @IsOptional() @IsString() organization_id?: string;

  @IsUUID()
  work_order_id: string;

  @IsString() @MinLength(2) @MaxLength(160)
  title: string;

  @IsString() @MinLength(2) @MaxLength(120)
  vendor: string;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "bill_date must be YYYY-MM-DD" })
  bill_date: string;

  @IsOptional() @IsString() @MaxLength(60)
  bill_number?: string;

  @IsNumber() @IsPositive()
  amount: number;

  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}
