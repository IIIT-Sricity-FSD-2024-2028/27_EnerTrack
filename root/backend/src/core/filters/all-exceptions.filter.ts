import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

type HttpExceptionResponse = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException
      ? this.normalizeExceptionResponse(exception.getResponse())
      : null;

    const message = isHttpException
      ? this.formatMessage(exceptionResponse?.message, exception.message)
      : "Internal server error";

    const error = isHttpException
      ? exceptionResponse?.error || this.getDefaultError(statusCode)
      : "Internal Server Error";

    if (!isHttpException || statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl} failed with ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      error,
      path: request.originalUrl,
      method: request.method,
      timestamp: new Date().toISOString(),
    });
  }

  private normalizeExceptionResponse(
    exceptionResponse: string | object,
  ): HttpExceptionResponse {
    if (typeof exceptionResponse === "string") {
      return { message: exceptionResponse };
    }

    return exceptionResponse as HttpExceptionResponse;
  }

  private formatMessage(
    rawMessage: string | string[] | undefined,
    fallback: string,
  ): string {
    if (Array.isArray(rawMessage)) {
      return rawMessage.join("; ");
    }

    return rawMessage || fallback || "An error occurred";
  }

  private getDefaultError(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return "Bad Request";
      case HttpStatus.UNAUTHORIZED:
        return "Unauthorized";
      case HttpStatus.FORBIDDEN:
        return "Forbidden";
      case HttpStatus.NOT_FOUND:
        return "Not Found";
      case HttpStatus.CONFLICT:
        return "Conflict";
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return "Internal Server Error";
      default:
        return "Internal Server Error";
    }
  }
}
