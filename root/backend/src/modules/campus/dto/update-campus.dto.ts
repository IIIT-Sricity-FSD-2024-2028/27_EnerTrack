import { PartialType } from "@nestjs/mapped-types";
import { CreateCampusDto } from "./create-campus.dto";

export class UpdateCampusDto extends PartialType(CreateCampusDto) {}
