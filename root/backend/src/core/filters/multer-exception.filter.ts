import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { MulterError } from "multer";

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let message = "File upload error";
    if (exception.code === "LIMIT_FILE_SIZE") {
      message = "File exceeds the allowed size limit";
    } else if (exception.code === "LIMIT_FILE_COUNT") {
      message = "Too many files uploaded";
    } else if (exception.code === "LIMIT_UNEXPECTED_FILE") {
      message = "Unexpected file field";
    }

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
    });
  }
}