import { Module } from "@nestjs/common";
import { PlatformInvoicesService } from "./platform-invoices.service";
import { PlatformInvoicesController } from "./platform-invoices.controller";
import { DatabaseModule } from "../../core/database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [PlatformInvoicesController],
  providers: [PlatformInvoicesService],
})
export class PlatformInvoicesModule {}
