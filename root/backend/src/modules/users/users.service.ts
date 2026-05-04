import * as crypto from "crypto";
import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { PutUserDto } from "./dto/put-user.dto";

import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private database: DatabaseService) {}

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
    const newRecord = { user_id: generatedId, ...createDto };
    this.database.users.push(newRecord as any);
    return newRecord;
  }

  findAll() {
    return this.database.users;
  }

  findOne(id: string) {
    const record = this.database.users.find((item) => item.user_id === id);
    if (!record) throw new NotFoundException(`User with ID ${id} not found`);
    return record;
  }

  put(id: string, putDto: PutUserDto) {
    const index = this.database.users.findIndex((item) => item.user_id === id);
    if (index === -1)
      throw new NotFoundException(`User with ID ${id} not found`);
    this.database.users[index] = { user_id: id, ...putDto } as any;
    return this.database.users[index];
  }
  update(id: string, updateDto: UpdateUserDto) {
    const index = this.database.users.findIndex((item) => item.user_id === id);
    if (index === -1)
      throw new NotFoundException(`User with ID ${id} not found`);
    this.database.users[index] = {
      ...this.database.users[index],
      ...updateDto,
    };
    return this.database.users[index];
  }

  remove(id: string) {
    const index = this.database.users.findIndex((item) => item.user_id === id);
    if (index === -1)
      throw new NotFoundException(`User with ID ${id} not found`);
    const removed = this.database.users.splice(index, 1);
    return removed[0];
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
