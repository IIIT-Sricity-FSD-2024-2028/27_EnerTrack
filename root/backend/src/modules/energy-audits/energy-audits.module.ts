import { Module } from "@nestjs/common";
import { EnergyAuditsService } from "./energy-audits.service";
import { EnergyAuditsController } from "./energy-audits.controller";
import { DatabaseModule } from "../../core/database/database.module";
import { DispatchModule } from "../dispatch/dispatch.module";

@Module({
  imports: [DatabaseModule, DispatchModule],
  controllers: [EnergyAuditsController],
  providers: [EnergyAuditsService],
})
export class EnergyAuditsModule {}
