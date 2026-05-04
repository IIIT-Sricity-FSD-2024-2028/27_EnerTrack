import { ServiceRequestsService } from './service-requests.service';
import { CreateServiceRequestDto } from './dto/create-service-request.dto';
import { UpdateServiceRequestDto } from './dto/update-service-request.dto';
export declare class ServiceRequestsController {
    private readonly serviceRequestsService;
    constructor(serviceRequestsService: ServiceRequestsService);
    create(createDto: CreateServiceRequestDto): {
        reporter_id: string;
        assigned_to_id?: string;
        category: string;
        issue_type: string;
        status?: string;
        service_request_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").ServiceRequest[];
    findOne(id: string): import("../../core/database/database.service").ServiceRequest;
    update(id: string, updateDto: UpdateServiceRequestDto): import("../../core/database/database.service").ServiceRequest;
    remove(id: string): import("../../core/database/database.service").ServiceRequest;
    getWorkOrders(id: string): import("../../core/database/database.service").WorkOrder[];
}
