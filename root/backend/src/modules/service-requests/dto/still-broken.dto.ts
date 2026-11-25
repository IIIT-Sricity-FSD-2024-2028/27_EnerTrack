import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

/** "Still broken": what is still wrong. A photo may come with it as multipart field "photo". */
export class StillBrokenDto {
  @ApiProperty({ example: "The tap still drips when it is turned off.", maxLength: 500 })
  // Checked in the service too, so a missing reason gets a plain message.
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
