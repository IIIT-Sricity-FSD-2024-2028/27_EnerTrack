import { WastageReportsService } from './wastage-reports.service';
import { CreateWastageReportDto } from './dto/create-wastage-report.dto';
import { UpdateWastageReportDto } from './dto/update-wastage-report.dto';
export declare class WastageReportsController {
    private readonly wastageReportsService;
    constructor(wastageReportsService: WastageReportsService);
    create(createDto: CreateWastageReportDto): {
        reporter_id: string;
        type: import("../../core/database/database.service").WastageType;
        status?: string;
        details: Record<string, any>;
        sensor_reading_id?: string;
        wastage_report_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").WastageReport[];
    findOne(id: string): import("../../core/database/database.service").WastageReport;
    update(id: string, updateDto: UpdateWastageReportDto): import("../../core/database/database.service").WastageReport;
    remove(id: string): import("../../core/database/database.service").WastageReport;
}
