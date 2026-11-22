import { Module } from "@nestjs/common";
import { TargetsService } from "./targets.service";
import { TargetsController } from "./targets.controller";
import { DatabaseModule } from "../../core/database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [TargetsController],
  providers: [TargetsService],
  exports: [TargetsService],
})
export class TargetsModule {}
