import { Module } from '@nestjs/common';
import { MeterReadingsService } from './meter-readings.service';
import { MeterReadingsController } from './meter-readings.controller';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [MeterReadingsController],
  providers: [MeterReadingsService],
})
export class MeterReadingsModule {}
