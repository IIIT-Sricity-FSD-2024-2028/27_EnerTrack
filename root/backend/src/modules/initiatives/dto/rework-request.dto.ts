import { IsString, MaxLength } from "class-validator";

/**
 * The officer asks for one closed job of an initiative to be redone. The
 * coordinator then decides who does it and by when (or declines).
 */
export class ReworkRequestDto {
  /** What needs redoing; shown to the coordinator and then the technician. */
  @IsString() @MaxLength(500) reason: string;
}
