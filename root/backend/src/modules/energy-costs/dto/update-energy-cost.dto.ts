import { PartialType } from "@nestjs/mapped-types";
import { CreateEnergyCostDto } from "./create-energy-cost.dto";

export class UpdateEnergyCostDto extends PartialType(CreateEnergyCostDto) {}
