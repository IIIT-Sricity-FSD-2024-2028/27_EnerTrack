import { InvoiceStatus } from '../../../core/database/database.service';
export declare class CreateInvoiceDto {
    department_id: string;
    approved_by_id?: string;
    invoice_number: string;
    vendor: string;
    amount: number;
    status: InvoiceStatus;
}
