import { PartialType } from "@nestjs/mapped-types";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { CreateInitiativeDto } from "./create-initiative.dto";

export class UpdateInitiativeDto extends PartialType(CreateInitiativeDto) {
  /** With an approval or rejection: the reason, shown to the proposer. */
  @IsOptional() @IsString() @MaxLength(500) decision_note?: string;
}
