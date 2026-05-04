import { Module } from "@nestjs/common";
import { ActivityLogsService } from "./activity-logs.service";
import { ActivityLogsController } from "./activity-logs.controller";
import { DatabaseModule } from "../../core/database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService],
})
export class ActivityLogsModule {}
