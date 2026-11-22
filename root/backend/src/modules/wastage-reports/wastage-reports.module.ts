import { Module } from "@nestjs/common";
import { WastageReportsService } from "./wastage-reports.service";
import { WastageReportsController } from "./wastage-reports.controller";
import { DatabaseModule } from "../../core/database/database.module";
import { DispatchModule } from "../dispatch/dispatch.module";

@Module({
  imports: [DatabaseModule, DispatchModule],
  controllers: [WastageReportsController],
  providers: [WastageReportsService],
})
export class WastageReportsModule {}
