import {
  BadGatewayException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  MetaGraphApiErrorBody,
  RETRYABLE_GRAPH_ERROR_CODES,
  RETRYABLE_HTTP_STATUS_CODES,
  WHATSAPP_CLOUD_API_VERSION,
  WhatsAppSendMessageResponse,
  WhatsAppSendMessageResult,
} from './whatsapp-cloud-api.constants';

@Injectable()
export class WhatsAppCloudApiService {
  private readonly logger = new Logger(WhatsAppCloudApiService.name);
  private readonly graphBase = `https://graph.facebook.com/${WHATSAPP_CLOUD_API_VERSION}`;
  private readonly maxAttempts = 3;

  async sendTextMessage(
    phoneNumberId: string,
    accessToken: string,
    recipientPhone: string,
    message: string,
  ): Promise<WhatsAppSendMessageResult> {
    const to = this.normalizeRecipientPhone(recipientPhone);
    const url = `${this.graphBase}/${phoneNumberId}/messages`;

    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: message },
          }),
          signal: AbortSignal.timeout(15_000),
        });

        const data = (await response.json()) as WhatsAppSendMessageResponse;

        if (!response.ok) {
          throw this.createGraphApiError(response.status, data, attempt);
        }

        const whatsappMessageId = data.messages?.[0]?.id;
        if (!whatsappMessageId) {
          throw new BadGatewayException(
            'WhatsApp Cloud API returned a success response without a message ID',
          );
        }

        const recipientWaId = data.contacts?.[0]?.wa_id ?? to;

        this.logger.log('WhatsApp message sent successfully', {
          phoneNumberId,
          recipientWaId,
          whatsappMessageId,
          attempt,
        });

        return { whatsappMessageId, recipientWaId };
      } catch (error) {
        lastError = error;

        if (!this.isRetryableError(error) || attempt === this.maxAttempts) {
          throw error;
        }

        const delayMs = attempt * 500;
        this.logger.warn('Retrying WhatsApp Cloud API send after transient failure', {
          phoneNumberId,
          recipientPhone: to,
          attempt,
          delayMs,
          error: error instanceof Error ? error.message : error,
        });

        await this.delay(delayMs);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new BadGatewayException('Failed to send WhatsApp message');
  }

  private createGraphApiError(
    status: number,
    data: MetaGraphApiErrorBody,
    attempt: number,
  ): Error {
    const graphError = data.error;
    const message =
      graphError?.message ?? `WhatsApp Cloud API request failed with status ${status}`;

    this.logger.error('WhatsApp Cloud API request failed', {
      status,
      code: graphError?.code,
      subcode: graphError?.error_subcode,
      fbtraceId: graphError?.fbtrace_id,
      attempt,
      message,
    });

    const error = new BadGatewayException(message);
    Object.assign(error, {
      status,
      graphErrorCode: graphError?.code,
      retryable: this.isRetryableGraphFailure(status, graphError?.code),
    });

    return error;
  }

  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof BadGatewayException)) {
      return true;
    }

    const retryable = (error as BadGatewayException & { retryable?: boolean }).retryable;
    return retryable === true;
  }

  private isRetryableGraphFailure(status: number, code?: number): boolean {
    if (RETRYABLE_HTTP_STATUS_CODES.has(status)) {
      return true;
    }

    return code !== undefined && RETRYABLE_GRAPH_ERROR_CODES.has(code);
  }

  private normalizeRecipientPhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
