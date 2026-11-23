import { Module } from "@nestjs/common";
import { SustainabilityReportsService } from "./sustainability-reports.service";
import { SustainabilityReportsController } from "./sustainability-reports.controller";
import { DatabaseModule } from "../../core/database/database.module";
import { SustainabilityMetricsModule } from "../sustainability-metrics/sustainability-metrics.module";
import { TargetsModule } from "../targets/targets.module";

@Module({
  imports: [DatabaseModule, SustainabilityMetricsModule, TargetsModule],
  controllers: [SustainabilityReportsController],
  providers: [SustainabilityReportsService],
})
export class SustainabilityReportsModule {}
