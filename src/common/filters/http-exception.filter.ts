import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { EvolutionApiException } from '../../modules/whatsapp/evolution-api.exception';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = this.resolveStatus(exception);
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
    } else {
      this.logger.warn('Request failed', logPayload);
    }

    if (exception instanceof EvolutionApiException) {
      response.status(exception.statusCode).json({
        statusCode: exception.statusCode,
        code: exception.code,
        message: exception.message,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (
        exceptionResponse &&
        typeof exceptionResponse === 'object' &&
        ('step' in exceptionResponse ||
          'steps' in exceptionResponse ||
          'action' in exceptionResponse ||
          'status' in exceptionResponse)
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

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (exception instanceof EvolutionApiException) {
      return exception.statusCode;
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveMessage(exception: unknown, status: number): string {
    if (exception instanceof EvolutionApiException) {
      return exception.message;
    }

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        return exceptionResponse;
      }
      if (
        exceptionResponse &&
        typeof exceptionResponse === 'object' &&
        'message' in exceptionResponse
      ) {
        const nested = (exceptionResponse as { message?: string | string[] }).message;
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
      return exception.message || 'Internal server error';
    }

    return status === HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Internal server error'
      : 'Request failed';
  }
}
