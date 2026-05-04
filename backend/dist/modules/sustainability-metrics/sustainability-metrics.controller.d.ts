import { SustainabilityMetricsService } from './sustainability-metrics.service';
import { CreateSustainabilityMetricDto } from './dto/create-sustainability-metric.dto';
import { UpdateSustainabilityMetricDto } from './dto/update-sustainability-metric.dto';
export declare class SustainabilityMetricsController {
    private readonly sustainabilityMetricsService;
    constructor(sustainabilityMetricsService: SustainabilityMetricsService);
    create(createDto: CreateSustainabilityMetricDto): {
        period: string;
        energy_consumed: number;
        water_usage: number;
        emissions: number;
        sustainability_metric_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").SustainabilityMetric[];
    findOne(id: string): import("../../core/database/database.service").SustainabilityMetric;
    update(id: string, updateDto: UpdateSustainabilityMetricDto): import("../../core/database/database.service").SustainabilityMetric;
    remove(id: string): import("../../core/database/database.service").SustainabilityMetric;
}
