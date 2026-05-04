import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
export declare class DepartmentsController {
    private readonly departmentsService;
    constructor(departmentsService: DepartmentsService);
    create(createDto: CreateDepartmentDto): {
        building_id: string;
        name: string;
        budget?: number;
        department_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").Department[];
    findOne(id: string): import("../../core/database/database.service").Department;
    update(id: string, updateDto: UpdateDepartmentDto): import("../../core/database/database.service").Department;
    remove(id: string): import("../../core/database/database.service").Department;
    getInvoices(id: string): import("../../core/database/database.service").Invoice[];
}
