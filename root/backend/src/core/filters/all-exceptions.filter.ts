import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { logWriter } from "../utils/log-writer";

type HttpExceptionResponse = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  /** Filename prefix; logWriter appends the date and the .log extension. */
  private readonly LOG_PREFIX = "error-";

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

    // Persist EVERY error to a dated file, not just 5xx. The console is lost
    // on restart, and the brief requires error information to be stored in
    // files — a 404 or a blocked 403 is exactly the kind of thing worth
    // being able to look up after the fact.
    this.writeErrorToFile({
      statusCode,
      message,
      error,
      method: request.method,
      url: request.originalUrl,
      role: (request.headers["x-role"] as string) || "none",
      ip: request.ip || "unknown",
      stack: exception instanceof Error ? exception.stack : String(exception),
      isServerError: statusCode >= HttpStatus.INTERNAL_SERVER_ERROR,
    });

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

  /**
   * Appends a structured error entry to the daily error log.
   *
   * Wrapped in try/catch because a failure to write a log must never turn a
   * handled 404 into an unhandled crash inside the exception filter itself.
   */
  private writeErrorToFile(entry: {
    statusCode: number;
    message: string;
    error: string;
    method: string;
    url: string;
    role: string;
    ip: string;
    stack: string;
    isServerError: boolean;
  }): void {
    const separator = "─".repeat(80);
    let block = `\n${separator}\n`;
    block += `  ${entry.isServerError ? "✘ SERVER ERROR" : "⚠ HANDLED ERROR"}\n`;
    block += `${separator}\n`;
    block += `  Timestamp   : ${new Date().toISOString()}\n`;
    block += `  Status Code : ${entry.statusCode}\n`;
    block += `  Error       : ${entry.error}\n`;
    block += `  Message     : ${entry.message}\n`;
    block += `  Route       : ${entry.method} ${entry.url}\n`;
    block += `  Role        : ${entry.role}\n`;
    block += `  IP          : ${entry.ip}\n`;

    // Stack traces are only useful for genuine crashes. Printing one for
    // every 404 would bury the real failures.
    if (entry.isServerError && entry.stack) {
      block += `${separator}\n`;
      block += `  Stack Trace:\n`;
      block +=
        entry.stack
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n") + "\n";
    }

    block += `${separator}\n`;

    // Server errors bypass the buffer. If the process is about to die, the
    // record of WHY must already be on disk — a 500 flushed five seconds
    // later is a 500 that never gets written. Handled 4xx entries are
    // routine and can wait for the next flush.
    logWriter.write(this.LOG_PREFIX, block, { immediate: entry.isServerError });
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
