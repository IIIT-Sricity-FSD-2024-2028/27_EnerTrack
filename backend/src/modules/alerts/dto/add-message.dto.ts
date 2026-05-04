import { IsString, MinLength } from 'class-validator';

export class AddMessageDto {
  @IsString() sender_role: string;
  @IsString() @MinLength(1) content: string;
}
