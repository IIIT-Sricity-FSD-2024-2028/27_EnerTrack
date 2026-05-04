import { Module } from "@nestjs/common";
import { WastageReportsService } from "./wastage-reports.service";
import { WastageReportsController } from "./wastage-reports.controller";
import { DatabaseModule } from "../../core/database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [WastageReportsController],
  providers: [WastageReportsService],
})
export class WastageReportsModule {}
