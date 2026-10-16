import { Module } from "@nestjs/common";
import { AuditRequestsService } from "./audit-requests.service";
import { AuditRequestsController } from "./audit-requests.controller";
import { DatabaseModule } from "../../core/database/database.module";
import { OrganizationsModule } from "../organizations/organizations.module";

@Module({
  imports: [DatabaseModule, OrganizationsModule],
  controllers: [AuditRequestsController],
  providers: [AuditRequestsService],
})
export class AuditRequestsModule {}
