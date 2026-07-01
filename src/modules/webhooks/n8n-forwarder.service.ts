import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { N8nForwardPayload } from './meta-webhook.types';

@Injectable()
export class N8nForwarderService {
  private readonly logger = new Logger(N8nForwarderService.name);
  private readonly maxAttempts = 3;

  constructor(private readonly config: ConfigService) {}

  async forward(payload: N8nForwardPayload): Promise<void> {
    const url = this.config.get<string>('N8N_WEBHOOK_URL');

    if (!url) {
      this.logger.warn('N8N_WEBHOOK_URL is not configured; skipping n8n forward');
      return;
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`n8n webhook returned ${response.status}: ${body}`);
        }

        this.logger.log('Forwarded WhatsApp message to n8n', {
          workspaceId: payload.workspaceId,
          messageId: payload.messageId,
          attempt,
        });
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(`n8n forward attempt ${attempt} failed`, {
          messageId: payload.messageId,
          error: error instanceof Error ? error.message : error,
        });

        if (attempt < this.maxAttempts) {
          await this.delay(attempt * 500);
        }
      }
    }

    this.logger.error('Failed to forward message to n8n after retries', {
      messageId: payload.messageId,
      error: lastError instanceof Error ? lastError.message : lastError,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
