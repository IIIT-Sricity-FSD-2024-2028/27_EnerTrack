import { Module } from "@nestjs/common";
import { WorkOrdersService } from "./work-orders.service";
import { WorkOrdersController } from "./work-orders.controller";
import { DatabaseModule } from "../../core/database/database.module";
import { DispatchModule } from "../dispatch/dispatch.module";

@Module({
  imports: [DatabaseModule, DispatchModule],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService],
})
export class WorkOrdersModule {}
