import { Module } from "@nestjs/common";
import { ServiceRequestsService } from "./service-requests.service";
import { ServiceRequestsController } from "./service-requests.controller";
import { DatabaseModule } from "../../core/database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [ServiceRequestsController],
  providers: [ServiceRequestsService],
})
export class ServiceRequestsModule {}
