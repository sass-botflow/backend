import { Logger } from '@nestjs/common';

const bootstrapLogger = new Logger('ProcessDiagnostics');

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function registerProcessDiagnostics(): void {
  process.on('uncaughtException', (error: Error) => {
    bootstrapLogger.error('uncaughtException — process will exit', error.stack ?? error.message);
    console.error('[FATAL] uncaughtException', error.stack ?? error.message);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const details = formatUnknownError(reason);
    bootstrapLogger.error('unhandledRejection', details);
    console.error('[FATAL] unhandledRejection', details);
  });

  process.on('SIGTERM', () => {
    bootstrapLogger.warn('Received SIGTERM — shutting down');
    console.error('[WARN] Received SIGTERM');
  });

  process.on('SIGINT', () => {
    bootstrapLogger.warn('Received SIGINT — shutting down');
    console.error('[WARN] Received SIGINT');
  });
}
