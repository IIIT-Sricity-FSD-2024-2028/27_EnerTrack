import { Module } from "@nestjs/common";
import { EnergyAuditsService } from "./energy-audits.service";
import { EnergyAuditsController } from "./energy-audits.controller";
import { DatabaseModule } from "../../core/database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [EnergyAuditsController],
  providers: [EnergyAuditsService],
})
export class EnergyAuditsModule {}
