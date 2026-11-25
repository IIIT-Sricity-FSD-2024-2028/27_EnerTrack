import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../core/database/database.module";
import { FoodWasteLogsController } from "./food-waste-logs.controller";
import { FoodWasteLogsService } from "./food-waste-logs.service";

@Module({
  imports: [DatabaseModule],
  controllers: [FoodWasteLogsController],
  providers: [FoodWasteLogsService],
  exports: [FoodWasteLogsService],
})
export class FoodWasteLogsModule {}
