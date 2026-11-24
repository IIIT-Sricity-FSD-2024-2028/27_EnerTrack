import { Module } from "@nestjs/common";
import { InitiativesService } from "./initiatives.service";
import { InitiativesController } from "./initiatives.controller";
import { DatabaseModule } from "../../core/database/database.module";
import { DispatchModule } from "../dispatch/dispatch.module";

@Module({
  // Dispatch: an initiative with on-site work sends its jobs at "Start work".
  imports: [DatabaseModule, DispatchModule],
  controllers: [InitiativesController],
  providers: [InitiativesService],
})
export class InitiativesModule {}
