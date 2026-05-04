import { Module } from "@nestjs/common";
import { FaultsService } from "./faults.service";
import { FaultsController } from "./faults.controller";
import { DatabaseModule } from "../../core/database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [FaultsController],
  providers: [FaultsService],
})
export class FaultsModule {}
