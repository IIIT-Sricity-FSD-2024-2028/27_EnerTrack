import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  Length,
  Matches,
  ValidateNested,
} from "class-validator";
import { UserRole } from "../../../core/database/database.service";
import {
  EMAIL,
  EMAIL_MESSAGE,
  NAME,
  NAME_MESSAGE,
  PHONE,
  PHONE_MESSAGE,
} from "../../../common/patterns";

/** One person in a bulk import. No password: the server generates it. */
export class BulkUserRowDto {
  @Length(2, 50) @Matches(NAME, { message: `name ${NAME_MESSAGE}` }) name: string;
  @Length(5, 254) @Matches(EMAIL, { message: `email ${EMAIL_MESSAGE}` }) email: string;
  @IsOptional() @Matches(PHONE, { message: `phone ${PHONE_MESSAGE}` }) phone?: string;
  @IsEnum(UserRole) role: UserRole;
}

/** Body for POST /api/users/bulk. */
export class BulkCreateUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BulkUserRowDto)
  users: BulkUserRowDto[];
}
