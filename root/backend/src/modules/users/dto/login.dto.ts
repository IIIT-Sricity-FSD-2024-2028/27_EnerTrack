import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'aadi@gmail.com', description: 'Registered user email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Aadi@123', description: 'User password (min 6 chars)' })
  @IsString()
  @MinLength(6)
  password: string;
}
