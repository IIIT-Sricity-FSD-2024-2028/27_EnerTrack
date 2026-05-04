import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    create(createDto: CreateUserDto): {
        name: string;
        email: string;
        phone?: string;
        password: string;
        role: import("../../core/database/database.service").UserRole;
        specialization?: string;
        user_id: `${string}-${string}-${string}-${string}-${string}`;
    };
    findAll(): import("../../core/database/database.service").User[];
    findOne(id: string): import("../../core/database/database.service").User;
    update(id: string, updateDto: UpdateUserDto): import("../../core/database/database.service").User;
    remove(id: string): import("../../core/database/database.service").User;
    getNotifications(id: string): import("../../core/database/database.service").Notification[];
}
