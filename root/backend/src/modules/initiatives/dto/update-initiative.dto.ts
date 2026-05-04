import { PartialType } from '@nestjs/mapped-types';
import { CreateInitiativeDto } from './create-initiative.dto';

export class UpdateInitiativeDto extends PartialType(CreateInitiativeDto) {}
