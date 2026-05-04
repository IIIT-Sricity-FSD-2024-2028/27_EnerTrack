import { DatabaseService } from '../../core/database/database.service';
import { CreateSustainabilityReportDto } from './dto/create-sustainability-report.dto';
import { UpdateSustainabilityReportDto } from './dto/update-sustainability-report.dto';
export declare class SustainabilityReportsService {
    private database;
    constructor(database: DatabaseService);
    create(createDto: CreateSustainabilityReportDto): {
        generated_at: string;
        generated_by_id: string;
        title: string;
        period: string;
        metrics: Record<string, any>;
        report_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").SustainabilityReport[];
    findOne(id: string): import("../../core/database/database.service").SustainabilityReport;
    update(id: string, updateDto: UpdateSustainabilityReportDto): import("../../core/database/database.service").SustainabilityReport;
    remove(id: string): import("../../core/database/database.service").SustainabilityReport;
}
