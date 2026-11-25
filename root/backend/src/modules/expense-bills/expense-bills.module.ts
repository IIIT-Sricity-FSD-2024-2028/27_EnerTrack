import { Module } from "@nestjs/common";
import { ExpenseBillsController } from "./expense-bills.controller";
import { ExpenseBillsService } from "./expense-bills.service";

@Module({
  controllers: [ExpenseBillsController],
  providers: [ExpenseBillsService],
  exports: [ExpenseBillsService],
})
export class ExpenseBillsModule {}
