import { PartialType } from '@nestjs/mapped-types';
import { CreateCampusDto } from './create-campu.dto';

export class UpdateCampusDto extends PartialType(CreateCampusDto) {}
