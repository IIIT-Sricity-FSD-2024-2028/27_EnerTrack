import { Module } from '@nestjs/common';
import { CampusService } from './campus.service';
import { CampusController } from './campus.controller';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [CampusController],
  providers: [CampusService],
})
export class CampusModule {}
