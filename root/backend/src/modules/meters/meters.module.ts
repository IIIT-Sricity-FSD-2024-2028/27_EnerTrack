import { Module } from "@nestjs/common";
import { MetersService } from "./meters.service";
import { MetersController } from "./meters.controller";
import { DatabaseModule } from "../../core/database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [MetersController],
  providers: [MetersService],
})
export class MetersModule {}
