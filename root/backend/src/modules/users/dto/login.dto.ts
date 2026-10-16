import { IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  EMAIL,
  EMAIL_MESSAGE,
  LOGIN_PASSWORD,
  LOGIN_PASSWORD_MESSAGE,
} from '../../../common/patterns';

export class LoginDto {
  @ApiProperty({ example: 'aadi@gmail.com', description: 'Registered user email' })
  @Length(5, 254)
  @Matches(EMAIL, { message: `email ${EMAIL_MESSAGE}` })
  email: string;

  @ApiProperty({ description: 'User password' })
  @IsString()
  @Matches(LOGIN_PASSWORD, { message: `password ${LOGIN_PASSWORD_MESSAGE}` })
  password: string;
}
