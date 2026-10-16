import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

/** Body of POST /wastage-reports/:id/comments. */
export class AddWastageCommentDto {
  /** The comment itself. Required, and not just spaces. */
  @IsString()
  @Matches(/\S/, { message: "text must not be empty" })
  @MaxLength(1000)
  text: string;

  /** Display name of the person commenting. Defaults to their role. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  author?: string;
}
