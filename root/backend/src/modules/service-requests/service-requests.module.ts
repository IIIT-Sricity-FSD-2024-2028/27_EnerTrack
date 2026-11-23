import { Module } from "@nestjs/common";
import { ServiceRequestsService } from "./service-requests.service";
import { IssueReportsService } from "./issue-reports.service";
import { ServiceRequestsController } from "./service-requests.controller";
import { DatabaseModule } from "../../core/database/database.module";
import { DispatchModule } from "../dispatch/dispatch.module";

@Module({
  imports: [DatabaseModule, DispatchModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService, IssueReportsService],
})
export class ServiceRequestsModule {}
