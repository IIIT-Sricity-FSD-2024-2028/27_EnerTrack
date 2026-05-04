import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
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
    const newRecord = { invoice_id: generatedId, ...createDto };
    this.database.invoices.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.invoices;
  }

  findOne(id: string) {
    const record = this.database.invoices.find(
      (item) => item.invoice_id === id,
    );
    if (!record) throw new NotFoundException(`Invoice with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutInvoiceDto) {
    const index = this.database.invoices.findIndex(
      (item) => item.invoice_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    this.database.invoices[index] = { invoice_id: id, ...putDto } as any;
    return this.database.invoices[index];
  }
  update(id: string, updateDto: UpdateInvoiceDto) {
    const index = this.database.invoices.findIndex(
      (item) => item.invoice_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    this.database.invoices[index] = {
      ...this.database.invoices[index],
      ...updateDto,
    };
    return this.database.invoices[index];
  }

  remove(id: string) {
    const index = this.database.invoices.findIndex(
      (item) => item.invoice_id === id,
    );
    if (index === -1)
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    const removed = this.database.invoices.splice(index, 1);
    return removed[0];
  }
}
