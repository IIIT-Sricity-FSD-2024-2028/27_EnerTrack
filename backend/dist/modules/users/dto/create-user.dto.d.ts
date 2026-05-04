import { UserRole } from '../../../core/database/database.service';
export declare class CreateUserDto {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: UserRole;
    specialization?: string;
}
