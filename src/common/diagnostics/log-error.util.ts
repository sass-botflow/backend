import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function logServiceError(
  logger: Logger,
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): void {
  const base = { context, ...metadata };

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error('Prisma known request error', {
      ...base,
      prismaCode: error.code,
      prismaMeta: error.meta,
      message: error.message,
      stack: error.stack,
    });
    console.error('[ERROR] Prisma known request error', {
      ...base,
      prismaCode: error.code,
      prismaMeta: error.meta,
      message: error.message,
      stack: error.stack,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    logger.error('Prisma validation error', {
      ...base,
      message: error.message,
      stack: error.stack,
    });
    console.error('[ERROR] Prisma validation error', {
      ...base,
      message: error.message,
      stack: error.stack,
    });
    return;
  }

  if (error instanceof Error) {
    logger.error('Service error', {
      ...base,
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    console.error('[ERROR] Service error', {
      ...base,
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return;
  }

  logger.error('Unknown service error', { ...base, error });
  console.error('[ERROR] Unknown service error', { ...base, error });
}
