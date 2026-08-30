import { PartialType } from "@nestjs/mapped-types";
import { CreatePlatformInvoiceDto } from "./create-platform-invoice.dto";

export class UpdatePlatformInvoiceDto extends PartialType(CreatePlatformInvoiceDto) {}
