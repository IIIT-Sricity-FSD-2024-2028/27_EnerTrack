import * as crypto from "crypto";
import * as fs from "fs";
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import {
  scopeToTenant,
  currentOrgId,
  assertTenantOwns,
} from "../../core/tenancy/tenant-context";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { PutInvoiceDto } from "./dto/put-invoice.dto";

import { UpdateInvoiceDto } from "./dto/update-invoice.dto";

@Injectable()
export class InvoicesService {
  constructor(private database: DatabaseService) {}

  create(createDto: CreateInvoiceDto) {
    if (createDto.invoice_number) {
      const exists = this.database.invoices.find(
        (x) => x.invoice_number === createDto.invoice_number,
      );
      if (exists)
        throw new ConflictException(
          `Duplicate invoice_number '${createDto.invoice_number}'`,
        );
    }
    if (createDto.department_id) {
      const exists = this.database.departments.find(
        (x) => x.department_id === createDto.department_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target departments with id '${createDto.department_id}' not found`,
        );
    }
    if (createDto.approved_by_id) {
      const exists = this.database.users.find(
        (x) => x.user_id === createDto.approved_by_id,
      );
      if (!exists)
        throw new NotFoundException(
          `Target users with id '${createDto.approved_by_id}' not found`,
        );
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { invoice_id: generatedId, ...createDto, organization_id: currentOrgId() ?? createDto.organization_id ?? null };
    this.database.invoices.push(newRecord as any);
    return newRecord;
  }
  attachDocument(id: string, file: Express.Multer.File) {
    const index = this.database.invoices.findIndex(
      (item) => item.invoice_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.invoices[index]))
      throw new NotFoundException(`Invoice with ID ${id} not found`);

    // Ownership is checked on the way IN as well as on the way out. Without
    // this, one tenant could attach a document to another tenant's invoice —
    // getDocument would then refuse to serve it back, but the write would
    // already have happened.
    if (!assertTenantOwns(this.database.invoices[index]))
      throw new NotFoundException(`Invoice with ID ${id} not found`);

    this.database.invoices[index] = {
      ...this.database.invoices[index],
      // The on-disk path stays server-side only. Clients get a URL they can
      // actually fetch, rather than a raw filesystem path that both leaks the
      // server layout and is useless to a browser.
      document_path: file.path,
      document_original_name: file.originalname,
      document_size: file.size,
      document_url: `/api/invoices/${id}/document`,
      document_uploaded_at: new Date().toISOString(),
    } as any;
    return this.stripInternalFields(this.database.invoices[index]);
  }

  /**
   * Resolves the stored document for an invoice, checking tenant ownership.
   *
   * The path comes from the database record, never from the URL, so there is
   * no way for a caller to steer this at an arbitrary file on disk.
   */
  getDocument(id: string) {
    const record = assertTenantOwns(
      this.database.invoices.find((item) => item.invoice_id === id),
    ) as any;

    if (!record) throw new NotFoundException(`Invoice with ID ${id} not found`);
    if (!record.document_path)
      throw new NotFoundException(`Invoice ${id} has no document attached`);
    if (!fs.existsSync(record.document_path))
      throw new NotFoundException(
        `The document for invoice ${id} is no longer on disk`,
      );

    return {
      path: record.document_path,
      filename: record.document_original_name || "invoice.pdf",
    };
  }

  /** Hides the server-side path from anything returned over the API. */
  private stripInternalFields(record: any) {
    const { document_path, ...safe } = record;
    return safe;
  }
  findAll() {
    return scopeToTenant(this.database.invoices);
  }

  findOne(id: string) {
    const record = assertTenantOwns(this.database.invoices.find(
      (item) => item.invoice_id === id,
    ));
    if (!record) throw new NotFoundException(`Invoice with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutInvoiceDto) {
    const index = this.database.invoices.findIndex(
      (item) => item.invoice_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.invoices[index]))
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    this.database.invoices[index] = {
      invoice_id: id,
      ...putDto,
      organization_id: this.database.invoices[index].organization_id,
    } as any;
    return this.database.invoices[index];
  }
  update(id: string, updateDto: UpdateInvoiceDto) {
    const index = this.database.invoices.findIndex(
      (item) => item.invoice_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.invoices[index]))
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    this.database.invoices[index] = {
      ...this.database.invoices[index],
      ...updateDto,
      organization_id: this.database.invoices[index].organization_id,
    };
    return this.database.invoices[index];
  }

  remove(id: string) {
    const index = this.database.invoices.findIndex(
      (item) => item.invoice_id === id,
    );
    if (index === -1 || !assertTenantOwns(this.database.invoices[index]))
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    const removed = this.database.invoices.splice(index, 1);
    return removed[0];
  }
}
