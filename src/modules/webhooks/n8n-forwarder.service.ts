import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { N8nForwardPayload, N8nReplyPayload } from './meta-webhook.types';

export interface N8nForwardResult {
  forwarded: boolean;
  replyText: string | null;
}

@Injectable()
export class N8nForwarderService {
  private readonly logger = new Logger(N8nForwarderService.name);
  private readonly maxAttempts = 3;

  constructor(private readonly config: ConfigService) {}

  async forward(payload: N8nForwardPayload): Promise<N8nForwardResult> {
    const url = this.config.get<string>('N8N_WEBHOOK_URL');

    if (!url) {
      this.logger.warn('N8N_WEBHOOK_URL is not configured; skipping n8n forward');
      return { forwarded: false, replyText: null };
    }

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`n8n webhook returned ${response.status}: ${body}`);
        }

        const replyText = await this.extractReplyText(response);

        this.logger.log('Forwarded WhatsApp message to n8n', {
          workspaceId: payload.workspaceId,
          messageId: payload.messageId,
          attempt,
          hasReply: Boolean(replyText),
        });

        return { forwarded: true, replyText };
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

    return { forwarded: false, replyText: null };
  }

  private async extractReplyText(response: Response): Promise<string | null> {
    const contentType = response.headers.get('content-type') ?? '';

    if (!contentType.includes('application/json')) {
      const text = (await response.text()).trim();
      return text.length > 0 ? text : null;
    }

    const data = (await response.json()) as N8nReplyPayload | string;

    if (typeof data === 'string') {
      const trimmed = data.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    const direct =
      data.reply?.trim() ||
      data.message?.trim() ||
      data.text?.trim() ||
      data.messages?.find((item) => item.text || item.message || item.reply)?.text?.trim() ||
      data.messages?.find((item) => item.text || item.message || item.reply)?.message?.trim() ||
      data.messages?.find((item) => item.text || item.message || item.reply)?.reply?.trim();

    return direct && direct.length > 0 ? direct : null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
