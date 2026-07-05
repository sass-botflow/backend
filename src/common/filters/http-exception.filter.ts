import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.resolveMessage(exception, status);

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
