import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './core/database/database.module';

import { UsersModule } from './modules/users/users.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CampusModule } from './modules/campus/campus.module';
import { BuildingsModule } from './modules/buildings/buildings.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { MetersModule } from './modules/meters/meters.module';
import { MeterReadingsModule } from './modules/meter-readings/meter-readings.module';
import { WastageReportsModule } from './modules/wastage-reports/wastage-reports.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { FaultsModule } from './modules/faults/faults.module';
import { ServiceRequestsModule } from './modules/service-requests/service-requests.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
import { EnergyCostsModule } from './modules/energy-costs/energy-costs.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { FinancialReportsModule } from './modules/financial-reports/financial-reports.module';
import { SustainabilityMetricsModule } from './modules/sustainability-metrics/sustainability-metrics.module';
import { InitiativesModule } from './modules/initiatives/initiatives.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { SustainabilityReportsModule } from './modules/sustainability-reports/sustainability-reports.module';

@Module({
  imports: [
    DatabaseModule,
    UsersModule, NotificationsModule, CampusModule, BuildingsModule,
    DepartmentsModule, MetersModule, MeterReadingsModule, WastageReportsModule,
    AlertsModule, FaultsModule, ServiceRequestsModule, WorkOrdersModule,
    EnergyCostsModule, InvoicesModule, FinancialReportsModule, SustainabilityMetricsModule,
    InitiativesModule, ActivityLogsModule, SustainabilityReportsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
