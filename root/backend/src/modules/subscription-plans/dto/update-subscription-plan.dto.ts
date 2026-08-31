import { PartialType } from "@nestjs/mapped-types";
import { CreateSubscriptionPlanDto } from "./create-subscription-plan.dto";

export class UpdateSubscriptionPlanDto extends PartialType(CreateSubscriptionPlanDto) {}
