import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import { scopeToTenant, currentOrgId } from "../../core/tenancy/tenant-context";
import { CreateUserDto } from "./dto/create-user.dto";
import { PutUserDto } from "./dto/put-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { hashPassword, verifyPassword } from "../../core/utils/crypto.util";

@Injectable()
export class UsersService {
  constructor(private database: DatabaseService) {}

  // Helper to remove password from returned user object
  private sanitizeUser(user: any) {
    if (!user) return user;
    const { password: _pw, ...safeUser } = user;
    return safeUser;
  }

  create(createDto: CreateUserDto) {
    if (createDto.email) {
      const exists = this.database.users.find(
        (x) => x.email === createDto.email,
      );
      if (exists)
        throw new ConflictException(`Duplicate email '${createDto.email}'`);
    }
    if (createDto.phone) {
      const exists = this.database.users?.find(
        (x) => x.phone === createDto.phone,
      );
      if (exists)
        throw new ConflictException(`Duplicate phone '${createDto.phone}'`);
    }
    const generatedId = crypto.randomUUID();
    const newRecord = { 
      user_id: generatedId, 
      ...createDto, 
      password: hashPassword(createDto.password),
      organization_id: createDto.organization_id ?? currentOrgId() 
    };
    this.database.users.push(newRecord as any);
    return this.sanitizeUser(newRecord);
  }

  findAll() {
    return scopeToTenant(this.database.users).map(u => this.sanitizeUser(u));
  }

  findOne(id: string) {
    const record = this.database.users.find((item) => item.user_id === id);
    if (!record) throw new NotFoundException(`User with ID ${id} not found`);
    return this.sanitizeUser(record);
  }

  put(id: string, putDto: PutUserDto) {
    const index = this.database.users.findIndex((item) => item.user_id === id);
    if (index === -1)
      throw new NotFoundException(`User with ID ${id} not found`);
      
    const updatedData = { ...putDto };
    if (updatedData.password) {
      updatedData.password = hashPassword(updatedData.password);
    }
      
    this.database.users[index] = { user_id: id, ...updatedData } as any;
    return this.sanitizeUser(this.database.users[index]);
  }

  update(id: string, updateDto: UpdateUserDto) {
    const index = this.database.users.findIndex((item) => item.user_id === id);
    if (index === -1)
      throw new NotFoundException(`User with ID ${id} not found`);
      
    const updatedData = { ...updateDto };
    if (updatedData.password) {
      updatedData.password = hashPassword(updatedData.password);
    }
      
    this.database.users[index] = {
      ...this.database.users[index],
      ...updatedData,
    };
    return this.sanitizeUser(this.database.users[index]);
  }

  remove(id: string) {
    const index = this.database.users.findIndex((item) => item.user_id === id);
    if (index === -1)
      throw new NotFoundException(`User with ID ${id} not found`);
    const removed = this.database.users.splice(index, 1);
    return this.sanitizeUser(removed[0]);
  }

  getNotifications(id: string) {
    return this.database.notifications.filter((item) => item.user_id === id);
  }

  login(email: string, password: string) {
    const user = this.database.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
    if (!user || !verifyPassword(password, user.password)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.sanitizeUser(user);
  }
}
