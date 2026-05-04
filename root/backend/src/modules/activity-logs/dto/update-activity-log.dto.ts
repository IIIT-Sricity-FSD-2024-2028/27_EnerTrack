import { PartialType } from '@nestjs/mapped-types';
import { CreateActivityLogDto } from './create-activity-log.dto';

export class UpdateActivityLogDto extends PartialType(CreateActivityLogDto) {}
