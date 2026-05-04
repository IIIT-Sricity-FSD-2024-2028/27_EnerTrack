import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    // Log the incoming request body
    if (Object.keys(request.body || {}).length > 0) {
      this.logger.log(`[REQUEST] ${method} ${originalUrl} | Body: ${JSON.stringify(request.body)}`);
    } else {
      this.logger.log(`[REQUEST] ${method} ${originalUrl}`);
    }

    // Capture the original send to log the response body
    const originalSend = response.send;
    response.send = function (body) {
      // Restore original send to prevent infinite recursion
      response.send = originalSend;
      
      const duration = Date.now() - startTime;
      const { statusCode } = response;
      
      const logger = new Logger('HTTP');
      if (statusCode >= 400) {
        logger.error(`[RESPONSE] ${method} ${originalUrl} ${statusCode} +${duration}ms | Error: ${body}`);
      } else {
        // Truncate large response bodies to avoid terminal spam
        let bodyString = typeof body === 'string' ? body : JSON.stringify(body);
        if (bodyString && bodyString.length > 300) {
          bodyString = bodyString.substring(0, 300) + '... (truncated)';
        }
        logger.log(`[RESPONSE] ${method} ${originalUrl} ${statusCode} +${duration}ms | Data: ${bodyString}`);
      }

      return response.send(body);
    };

    next();
  }
}
