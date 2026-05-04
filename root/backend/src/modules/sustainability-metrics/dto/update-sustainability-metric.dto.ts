import { PartialType } from "@nestjs/mapped-types";
import { CreateSustainabilityMetricDto } from "./create-sustainability-metric.dto";

export class UpdateSustainabilityMetricDto extends PartialType(
  CreateSustainabilityMetricDto,
) {}
