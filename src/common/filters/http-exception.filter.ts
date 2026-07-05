import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.resolveMessage(exception, status);

    const logPayload = {
      method: request.method,
      path: request.url,
      status,
      message,
      userId: (request as Request & { user?: { sub?: string } }).user?.sub,
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (status >= 500) {
      this.logger.error('Request failed with server error', logPayload);
      console.error('[ERROR] Request failed with server error', logPayload);
    } else {
      this.logger.warn('Request failed', logPayload);
    }

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (
        exceptionResponse &&
        typeof exceptionResponse === 'object' &&
        'step' in exceptionResponse
      ) {
        response.status(status).json({
          statusCode: status,
          ...(exceptionResponse as Record<string, unknown>),
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  private resolveMessage(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (response && typeof response === 'object' && 'message' in response) {
        const nested = (response as { message?: string | string[] }).message;
        if (Array.isArray(nested)) {
          return nested.join(', ');
        }
        if (typeof nested === 'string') {
          return nested;
        }
      }
      return exception.message;
    }

    if (exception instanceof Error) {
      if (exception.message.includes('Configuration key')) {
        return `Server configuration error: ${exception.message}`;
      }
      if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
        return exception.message || 'Internal server error';
      }
      return exception.message;
    }

    return 'Internal server error';
  }
}
