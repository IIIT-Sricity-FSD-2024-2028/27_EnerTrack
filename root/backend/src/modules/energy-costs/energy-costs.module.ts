import { Module } from '@nestjs/common';
import { EnergyCostsService } from './energy-costs.service';
import { EnergyCostsController } from './energy-costs.controller';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [EnergyCostsController],
  providers: [EnergyCostsService],
})
export class EnergyCostsModule {}
