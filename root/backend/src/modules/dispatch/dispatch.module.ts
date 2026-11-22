import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../core/database/database.module";
import { DispatchController } from "./dispatch.controller";
import { Clock } from "./clock";
import { SlaService } from "./sla.service";
import { DispatchService } from "./dispatch.service";

@Module({
  imports: [DatabaseModule],
  controllers: [DispatchController],
  providers: [DispatchService, SlaService, Clock],
  exports: [DispatchService, SlaService, Clock],
})
export class DispatchModule {}
