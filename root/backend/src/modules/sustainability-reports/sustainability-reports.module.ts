import { Module } from '@nestjs/common';
import { SustainabilityReportsService } from './sustainability-reports.service';
import { SustainabilityReportsController } from './sustainability-reports.controller';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SustainabilityReportsController],
  providers: [SustainabilityReportsService],
})
export class SustainabilityReportsModule {}
