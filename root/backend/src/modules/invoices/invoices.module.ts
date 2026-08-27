import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { InvoicesController } from "./invoices.controller";
import { InvoiceAccessMiddleware } from "./invoice-access.middleware";
import { DatabaseModule } from "../../core/database/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule implements NestModule {
  /**
   * Router-level middleware registered by a FEATURE module.
   *
   * AppModule is not special: any module implementing NestModule can bind
   * its own middleware, and Nest collects every configure() at startup.
   * Auditing access to financial records is an invoices concern, so it is
   * declared here rather than in the root module — deleting this module
   * removes its middleware with it, leaving nothing dangling centrally.
   *
   * Bound to the CONTROLLER CLASS rather than a path string. Nest reads
   * InvoicesController's route decorators and binds one route per handler,
   * so any route added to that controller later is covered automatically
   * with no path pattern to keep in sync.
   *
   * Runs after every middleware registered in AppModule, because root
   * module middleware is registered first.
   */
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(InvoiceAccessMiddleware).forRoutes(InvoicesController);
  }
}
