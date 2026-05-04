import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateActivityLogDto {
  @IsOptional() @IsUUID() user_id?: string;
  @IsString() action_type: string;
  @IsString() title: string;
  @IsString() timestamp: string;
}
