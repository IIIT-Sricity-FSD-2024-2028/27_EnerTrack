import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from "class-validator";
import { PlatformInvoiceStatus } from "../../../core/database/database.service";

export class CreatePlatformInvoiceDto {
  /** Tenant being billed. Defaults to the x-org-id header. */
  @IsOptional() @IsString() organization_id?: string;

  @IsString() subscription_id: string;

  @Matches(/^\d{4}-\d{2}$/, { message: "period must be YYYY-MM" })
  period: string;

  @IsArray() line_items: any[];

  @IsNumber() @Min(0) subtotal: number;
  @IsNumber() @Min(0) tax_pct: number;
  @IsNumber() @Min(0) tax_amount: number;
  @IsNumber() @Min(0) total: number;

  @IsEnum(PlatformInvoiceStatus) status: PlatformInvoiceStatus;

  @IsOptional() @IsISO8601() issued_on?: string;
  @IsOptional() @IsISO8601() due_on?: string;
  @IsOptional() @IsISO8601() paid_on?: string;
}

/** Body for POST /platform-invoices/generate. */
export class GenerateInvoiceDto {
  @IsString() organization_id: string;

  @Matches(/^\d{4}-\d{2}$/, { message: "period must be YYYY-MM" })
  period: string;

  /** Overrides the default 18% GST. */
  @IsOptional() @IsNumber() @Min(0) tax_pct?: number;
}
