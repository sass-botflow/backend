import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EvolutionApiException } from './evolution-api.exception';
import {
  EVOLUTION_INTEGRATION,
  EVOLUTION_WEBHOOK_EVENTS,
  EvolutionConnectionStateResponse,
  EvolutionCreateInstancePayload,
  EvolutionProviderConfig,
  EvolutionQrResponse,
  EvolutionSendTextPayload,
  EvolutionSendTextResponse,
} from './evolution-api.types';

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;

@Injectable()
export class EvolutionApiService {
  private readonly logger = new Logger(EvolutionApiService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.getConfig());
  }

  getConfig(): EvolutionProviderConfig | null {
    const baseUrl = this.config.get<string>('EVOLUTION_API_URL')?.trim();
    const apiKey = this.config.get<string>('EVOLUTION_API_KEY')?.trim();

    if (!baseUrl || !apiKey) {
      return null;
    }

    const webhookUrl =
      this.config.get<string>('EVOLUTION_WEBHOOK_URL')?.trim() ??
      this.config.get<string>('BACKEND_URL')?.trim()
        ? `${this.config.get<string>('BACKEND_URL')!.replace(/\/$/, '')}/webhooks/evolution`
        : 'https://api.botflow.ink/webhooks/evolution';

    return {
      baseUrl: baseUrl.replace(/\/$/, ''),
      apiKey,
      webhookUrl,
    };
  }

  async createInstance(instanceName: string): Promise<void> {
    const cfg = this.requireConfig();

    const body: EvolutionCreateInstancePayload = {
      instanceName,
      integration: EVOLUTION_INTEGRATION,
      qrcode: true,
      webhook: {
        url: cfg.webhookUrl,
        byEvents: true,
        base64: true,
        events: [...EVOLUTION_WEBHOOK_EVENTS],
      },
    };

    await this.request<void>('createInstance', 'POST', '/instance/create', body);
    this.logger.log('Evolution instance created', { instanceName });
  }

  async connectInstance(instanceName: string): Promise<EvolutionQrResponse> {
    const data = await this.request<EvolutionQrResponse>(
      'connectInstance',
      'GET',
      `/instance/connect/${encodeURIComponent(instanceName)}`,
    );

    this.logger.log('Evolution QR requested', {
      instanceName,
      hasBase64: Boolean(data.base64),
    });

    return data;
  }

  async getConnectionState(instanceName: string): Promise<EvolutionConnectionStateResponse> {
    const data = await this.request<EvolutionConnectionStateResponse>(
      'getConnectionState',
      'GET',
      `/instance/connectionState/${encodeURIComponent(instanceName)}`,
    );

    this.logger.log('Evolution connection state fetched', {
      instanceName,
      state: data.instance?.state ?? data.state,
    });

    return data;
  }

  async deleteInstance(instanceName: string): Promise<void> {
    await this.request<void>(
      'deleteInstance',
      'DELETE',
      `/instance/delete/${encodeURIComponent(instanceName)}`,
    );
    this.logger.log('Evolution instance deleted', { instanceName });
  }

  async setWebhook(instanceName: string): Promise<void> {
    const cfg = this.requireConfig();

    await this.request<void>(
      'setWebhook',
      'POST',
      `/webhook/set/${encodeURIComponent(instanceName)}`,
      {
        webhook: {
          enabled: true,
          url: cfg.webhookUrl,
          webhookByEvents: true,
          webhookBase64: true,
          events: [...EVOLUTION_WEBHOOK_EVENTS],
        },
      },
    );

    this.logger.log('Evolution webhook subscribed', { instanceName, url: cfg.webhookUrl });
  }

  async sendTextMessage(
    instanceName: string,
    payload: EvolutionSendTextPayload,
  ): Promise<EvolutionSendTextResponse> {
    const data = await this.request<EvolutionSendTextResponse>(
      'sendTextMessage',
      'POST',
      `/message/sendText/${encodeURIComponent(instanceName)}`,
      payload,
    );

    this.logger.log('Evolution message sent', {
      instanceName,
      to: payload.number,
      messageId: data.key?.id,
    });

    return data;
  }

  async logoutInstance(instanceName: string): Promise<void> {
    await this.request<void>(
      'logoutInstance',
      'DELETE',
      `/instance/logout/${encodeURIComponent(instanceName)}`,
    );
    this.logger.log('Evolution instance logged out', { instanceName });
  }

  private requireConfig(): EvolutionProviderConfig {
    const cfg = this.getConfig();
    if (!cfg) {
      throw new EvolutionApiException(
        'EVOLUTION_UNAVAILABLE',
        'Evolution API is not configured. Set EVOLUTION_API_URL and EVOLUTION_API_KEY.',
        503,
      );
    }
    return cfg;
  }

  private async request<T>(
    operation: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const cfg = this.requireConfig();
    const url = `${cfg.baseUrl}${path}`;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.logger.log('Evolution API request', { operation, method, path, attempt });

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            apikey: cfg.apiKey,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        const text = await response.text();
        let data: unknown = null;

        if (text) {
          try {
            data = JSON.parse(text) as T;
          } catch {
            data = text;
          }
        }

        if (!response.ok) {
          this.logger.error('Evolution API request failed', {
            operation,
            method,
            path,
            status: response.status,
            attempt,
            evolutionResponse: data,
          });

          if (response.status === 404) {
            throw new EvolutionApiException(
              'INSTANCE_NOT_FOUND',
              `Evolution instance not found for operation ${operation}`,
              404,
              data,
            );
          }

          if (response.status >= 500 && attempt < MAX_RETRIES) {
            await this.delay(attempt * 400);
            continue;
          }

          throw new EvolutionApiException(
            'EVOLUTION_REQUEST_FAILED',
            `Evolution API ${operation} failed (${response.status})`,
            response.status >= 500 ? 502 : response.status,
            data,
          );
        }

        this.logger.log('Evolution API request succeeded', { operation, path, attempt });
        return data as T;
      } catch (error) {
        lastError = error;

        if (error instanceof EvolutionApiException) {
          throw error;
        }

        this.logger.error('Evolution API network error', {
          operation,
          path,
          attempt,
          error: error instanceof Error ? error.message : error,
        });

        if (attempt === MAX_RETRIES) {
          throw new EvolutionApiException(
            'EVOLUTION_UNAVAILABLE',
            'Evolution API is unavailable',
            503,
            lastError,
          );
        }

        await this.delay(attempt * 400);
      }
    }

    throw new EvolutionApiException(
      'EVOLUTION_UNAVAILABLE',
      'Evolution API is unavailable',
      503,
      lastError,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
