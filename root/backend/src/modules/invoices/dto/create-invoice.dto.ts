import { IsString, IsUUID, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { InvoiceStatus } from '../../../core/database/database.service';

export class CreateInvoiceDto {
  @IsUUID() department_id: string;
  @IsOptional() @IsUUID() approved_by_id?: string;
  @IsString() invoice_number: string;
  @IsString() vendor: string;
  @IsNumber() amount: number;
  @IsEnum(InvoiceStatus) status: InvoiceStatus;
}
