import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    
    const { method, originalUrl, body } = request;
    const startTime = Date.now();

    // Log the request
    if (body && Object.keys(body).length > 0) {
      this.logger.log(`[REQUEST] ${method} ${originalUrl} | Body: ${JSON.stringify(body)}`);
    } else {
      this.logger.log(`[REQUEST] ${method} ${originalUrl}`);
    }

    return next.handle().pipe(
      tap({
        next: (data: any) => {
          const duration = Date.now() - startTime;
          let dataStr = JSON.stringify(data) || '';
          if (dataStr.length > 300) dataStr = dataStr.substring(0, 300) + '... (truncated)';
          this.logger.log(`[RESPONSE] ${method} ${originalUrl} ${response.statusCode} +${duration}ms | Data: ${dataStr}`);
        },
        error: (error: any) => {
          const duration = Date.now() - startTime;
          const status = error.status || 500;
          this.logger.error(`[RESPONSE ERROR] ${method} ${originalUrl} ${status} +${duration}ms | Error: ${error.message}`);
        }
      }),
    );
  }
}
