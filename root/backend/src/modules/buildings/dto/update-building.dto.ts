import { PartialType } from '@nestjs/mapped-types';
import { CreateBuildingDto } from './create-building.dto';

export class UpdateBuildingDto extends PartialType(CreateBuildingDto) {}
