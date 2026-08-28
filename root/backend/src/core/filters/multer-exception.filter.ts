import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from "@nestjs/common";
import { Request, Response } from "express";
import { MulterError } from "multer";

/**
 * Translates multer's raw error codes into the same JSON envelope every other
 * error in the app uses.
 *
 * Applied per-route with @UseFilters on the three upload endpoints rather than
 * globally: route-level filters take precedence over the global @Catch() one,
 * and a MulterError can only ever originate from a route that accepts uploads.
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let message = "File upload error";
    if (exception.code === "LIMIT_FILE_SIZE") {
      message = "File exceeds the allowed size limit";
    } else if (exception.code === "LIMIT_FILE_COUNT") {
      message = "Too many files uploaded";
    } else if (exception.code === "LIMIT_UNEXPECTED_FILE") {
      message = `Unexpected file field '${exception.field}'`;
    }

    // Shape matches AllExceptionsFilter exactly, so the frontend has one
    // error format to handle rather than two.
    response.status(HttpStatus.BAD_REQUEST).json({
      success: false,
      statusCode: HttpStatus.BAD_REQUEST,
      message,
      error: "Bad Request",
      path: request.originalUrl,
      method: request.method,
      timestamp: new Date().toISOString(),
    });
  }
}