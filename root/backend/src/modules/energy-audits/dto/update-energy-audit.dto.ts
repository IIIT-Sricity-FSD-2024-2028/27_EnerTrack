import { PartialType } from "@nestjs/mapped-types";
import { CreateEnergyAuditDto } from "./create-energy-audit.dto";

export class UpdateEnergyAuditDto extends PartialType(CreateEnergyAuditDto) {}
