import { Module } from '@nestjs/common';
import { SustainabilityMetricsService } from './sustainability-metrics.service';
import { SustainabilityMetricsController } from './sustainability-metrics.controller';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SustainabilityMetricsController],
  providers: [SustainabilityMetricsService],
})
export class SustainabilityMetricsModule {}
