import { Module } from '@nestjs/common';
import { FinancialReportsService } from './financial-reports.service';
import { FinancialReportsController } from './financial-reports.controller';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FinancialReportsController],
  providers: [FinancialReportsService],
})
export class FinancialReportsModule {}
