import { IsString, Matches, MaxLength } from "class-validator";

/** The officer sends one closed job of an initiative back for rework. */
export class SendBackDto {
  /** What needs redoing; shown to the technician. */
  @IsString() @MaxLength(500) reason: string;
  /** YYYY-MM-DD. The rework job's finish date. */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "finish_by must be YYYY-MM-DD" }) finish_by: string;
}
