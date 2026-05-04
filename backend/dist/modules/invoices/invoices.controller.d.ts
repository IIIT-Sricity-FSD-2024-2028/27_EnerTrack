import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
export declare class InvoicesController {
    private readonly invoicesService;
    constructor(invoicesService: InvoicesService);
    create(createDto: CreateInvoiceDto): {
        department_id: string;
        approved_by_id?: string;
        invoice_number: string;
        vendor: string;
        amount: number;
        status: import("../../core/database/database.service").InvoiceStatus;
        invoice_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").Invoice[];
    findOne(id: string): import("../../core/database/database.service").Invoice;
    update(id: string, updateDto: UpdateInvoiceDto): import("../../core/database/database.service").Invoice;
    remove(id: string): import("../../core/database/database.service").Invoice;
}
