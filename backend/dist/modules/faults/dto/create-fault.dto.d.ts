import { FaultSeverity, FaultStatus } from '../../../core/database/database.service';
export declare class CreateFaultDto {
    alert_id?: string;
    assigned_to_id?: string;
    asset_name: string;
    fault_type: string;
    severity: FaultSeverity;
    status: FaultStatus;
}
