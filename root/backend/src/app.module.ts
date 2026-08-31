import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DatabaseModule } from "./core/database/database.module";
import { TenantMiddleware } from "./core/tenancy/tenant.middleware";
import { LoggerMiddleware } from "./core/middleware/logger.middleware";
import { SecurityMiddleware } from "./core/middleware/security.middleware";
import { UploadAuditMiddleware } from "./core/middleware/upload-audit.middleware";

import { OrganizationsModule } from "./modules/organizations/organizations.module";

// Revenue model: EnerTrack's own business, layered over the client-facing
// modules below rather than replacing any of them.
import { SubscriptionPlansModule } from "./modules/subscription-plans/subscription-plans.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { EnergyAuditsModule } from "./modules/energy-audits/energy-audits.module";
import { PlatformInvoicesModule } from "./modules/platform-invoices/platform-invoices.module";
import { UsersModule } from "./modules/users/users.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { CampusModule } from "./modules/campus/campus.module";
import { BuildingsModule } from "./modules/buildings/buildings.module";
import { DepartmentsModule } from "./modules/departments/departments.module";
import { MetersModule } from "./modules/meters/meters.module";
import { MeterReadingsModule } from "./modules/meter-readings/meter-readings.module";
import { WastageReportsModule } from "./modules/wastage-reports/wastage-reports.module";
import { AlertsModule } from "./modules/alerts/alerts.module";
import { FaultsModule } from "./modules/faults/faults.module";
import { ServiceRequestsModule } from "./modules/service-requests/service-requests.module";
import { WorkOrdersModule } from "./modules/work-orders/work-orders.module";
import { EnergyCostsModule } from "./modules/energy-costs/energy-costs.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { FinancialReportsModule } from "./modules/financial-reports/financial-reports.module";
import { SustainabilityMetricsModule } from "./modules/sustainability-metrics/sustainability-metrics.module";
import { InitiativesModule } from "./modules/initiatives/initiatives.module";
import { ActivityLogsModule } from "./modules/activity-logs/activity-logs.module";
import { SustainabilityReportsModule } from "./modules/sustainability-reports/sustainability-reports.module";

@Module({
  imports: [
    DatabaseModule,
    OrganizationsModule,
    SubscriptionPlansModule,
    SubscriptionsModule,
    EnergyAuditsModule,
    PlatformInvoicesModule,
    UsersModule,
    NotificationsModule,
    CampusModule,
    BuildingsModule,
    DepartmentsModule,
    MetersModule,
    MeterReadingsModule,
    WastageReportsModule,
    AlertsModule,
    FaultsModule,
    ServiceRequestsModule,
    WorkOrdersModule,
    EnergyCostsModule,
    InvoicesModule,
    FinancialReportsModule,
    SustainabilityMetricsModule,
    InitiativesModule,
    ActivityLogsModule,
    SustainabilityReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  /**
   * Middleware registration, in three tiers of decreasing scope.
   *
   * Registration order below IS execution order, so a request passes through
   * tier 1, then tier 2, then tier 3 before reaching guards and controllers.
   *
   * ── TIER 1: every route ─────────────────────────────────────────────
   *  SecurityMiddleware — validates x-role against the UserRole enum and
   *    deep-scans body/query/params for XSS, writing blocked attempts to
   *    logs/security-threats-YYYY-MM-DD.log
   *  TenantMiddleware   — opens the per-request x-org-id scope
   *  Both must see every request, so both use the "*" wildcard. Security
   *  runs first so a malicious payload is rejected before anything else
   *  touches it.
   *
   * ── TIER 2: every route except the API docs ─────────────────────────
   *  LoggerMiddleware — logs request and response bodies to
   *    logs/custom-debug-YYYY-MM-DD.log. Swagger UI is excluded: loading
   *    /api/docs pulls several static assets, and writing an 80-column
   *    block to disk for each of them buries the real API traffic.
   *
   * ── TIER 3: three specific routes (ROUTER-LEVEL) ────────────────────
   *  UploadAuditMiddleware — bound to individual path + method pairs
   *    rather than a wildcard, so it fires on the file-upload endpoints
   *    and provably nowhere else.
   *
   * NOTE ON PATHS. The two APIs take different conventions, and getting
   * either wrong fails silently rather than erroring:
   *   • forRoutes() paths are relative — Nest prepends the global "api"
   *     prefix, so write 'invoices/:id/document', never 'api/invoices/...'
   *   • exclude() paths are absolute — they are matched against the full
   *     URL with no prefix added, so write 'api/docs', not 'docs'
   *
   * NOTE ON METHODS. A bare string route ('invoices') binds through
   * Express's app.use, which matches by PREFIX. Supplying a method binds
   * through app.post, which matches EXACTLY — which is why the upload
   * paths below are written out in full, including the :id segment.
   *
   * Morgan, Helmet and express-rate-limit are application-level and are
   * registered separately with app.use() in main.ts.
   */
  configure(consumer: MiddlewareConsumer) {
    // Tier 1 — application-wide
    consumer
      .apply(SecurityMiddleware, TenantMiddleware)
      .forRoutes("*");

    // Tier 2 — application-wide, minus the Swagger assets
    consumer
      .apply(LoggerMiddleware)
      .exclude("api/docs", "api/docs/(.*)")
      .forRoutes("*");

    // Tier 3 — router-level: the three file-upload routes only
    consumer
      .apply(UploadAuditMiddleware)
      .forRoutes(
        { path: "meter-readings/upload", method: RequestMethod.POST },
        { path: "invoices/:id/document", method: RequestMethod.POST },
        { path: "wastage-reports/:id/photos", method: RequestMethod.POST },
      );
  }
}
