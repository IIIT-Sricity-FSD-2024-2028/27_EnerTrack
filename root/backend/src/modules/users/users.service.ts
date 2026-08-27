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

@Injectable()
export class UsersService {
  constructor(private database: DatabaseService) {}

  /**
   * Strips the password before a user record leaves the API.
   *
   * login() already did this, but the list and read endpoints did not, so
   * GET /api/users returned every user's password in plaintext to any caller
   * holding a valid role header. Centralised here so a new endpoint cannot
   * quietly reintroduce the leak.
   */
  private withoutPassword<T extends Record<string, any>>(record: T) {
    if (!record) return record;
    const { password: _pw, ...safe } = record;
    return safe;
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
    const newRecord = { user_id: generatedId, ...createDto, organization_id: createDto.organization_id ?? currentOrgId() };
    this.database.users.push(newRecord as any);
    return this.withoutPassword(newRecord);
  }

  findAll() {
    return scopeToTenant(this.database.users).map((u) =>
      this.withoutPassword(u),
    );
  }

  findOne(id: string) {
    const record = this.database.users.find((item) => item.user_id === id);
    if (!record) throw new NotFoundException(`User with ID ${id} not found`);
    return this.withoutPassword(record);
  }

  put(id: string, putDto: PutUserDto) {
    const index = this.database.users.findIndex((item) => item.user_id === id);
    if (index === -1)
      throw new NotFoundException(`User with ID ${id} not found`);
    this.database.users[index] = { user_id: id, ...putDto } as any;
    return this.withoutPassword(this.database.users[index]);
  }
  update(id: string, updateDto: UpdateUserDto) {
    const index = this.database.users.findIndex((item) => item.user_id === id);
    if (index === -1)
      throw new NotFoundException(`User with ID ${id} not found`);
    this.database.users[index] = {
      ...this.database.users[index],
      ...updateDto,
    };
    return this.withoutPassword(this.database.users[index]);
  }

  remove(id: string) {
    const index = this.database.users.findIndex((item) => item.user_id === id);
    if (index === -1)
      throw new NotFoundException(`User with ID ${id} not found`);
    const removed = this.database.users.splice(index, 1);
    return this.withoutPassword(removed[0]);
  }

  getNotifications(id: string) {
    return this.database.notifications.filter((item) => item.user_id === id);
  }

  login(email: string, password: string) {
    const user = this.database.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
    );
    if (!user) throw new UnauthorizedException('Invalid email or password');
    // Never send the password back to the client
    const { password: _pw, ...safeUser } = user;
    return safeUser;
  }
}
