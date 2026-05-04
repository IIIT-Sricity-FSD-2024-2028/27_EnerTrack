import { DatabaseService } from '../../core/database/database.service';
import { CreateFinancialReportDto } from './dto/create-financial-report.dto';
import { UpdateFinancialReportDto } from './dto/update-financial-report.dto';
export declare class FinancialReportsService {
    private database;
    constructor(database: DatabaseService);
    create(createDto: CreateFinancialReportDto): {
        generated_by_id: string;
        building_id?: string;
        department_id?: string;
        title: string;
        period: string;
        roi?: string;
        npv?: number;
        financial_report_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").FinancialReport[];
    findOne(id: string): import("../../core/database/database.service").FinancialReport;
    update(id: string, updateDto: UpdateFinancialReportDto): import("../../core/database/database.service").FinancialReport;
    remove(id: string): import("../../core/database/database.service").FinancialReport;
}
