import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EvolutionConnectResult,
  EvolutionConnectionStateResult,
  EvolutionCreateInstanceResult,
  EvolutionProviderConfig,
} from './evolution.types';

@Injectable()
export class EvolutionProvider {
  private readonly logger = new Logger(EvolutionProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.getConfig());
  }

  async createInstance(instanceName: string): Promise<EvolutionCreateInstanceResult> {
    const evolutionConfig = this.requireConfig();

    if (!evolutionConfig) {
      this.logger.warn('Evolution API not configured — returning mocked createInstance success', {
        instanceName,
      });
      return { instanceName, mocked: true };
    }

    await this.request(evolutionConfig, '/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: false,
      }),
    });

    this.logger.log('Evolution instance created', { instanceName });

    return { instanceName, mocked: false };
  }

  async connectInstance(instanceName: string): Promise<EvolutionConnectResult> {
    const evolutionConfig = this.requireConfig();

    if (!evolutionConfig) {
      throw new ServiceUnavailableException(
        'Evolution API is not configured. Set EVOLUTION_API_URL and EVOLUTION_API_KEY on the backend.',
      );
    }

    const data = await this.request<Record<string, unknown>>(
      evolutionConfig,
      `/instance/connect/${encodeURIComponent(instanceName)}`,
      { method: 'GET' },
    );

    const base64 = this.extractQrBase64(data);
    if (!base64) {
      this.logger.error('Evolution connect response missing QR code', {
        instanceName,
        keys: Object.keys(data),
      });
      throw new BadGatewayException(
        'Evolution API did not return a QR code. The instance may already be connected.',
      );
    }

    this.logger.log('Evolution QR code fetched', { instanceName });

    return { base64, mocked: false };
  }

  async getConnectionState(instanceName: string): Promise<EvolutionConnectionStateResult> {
    const evolutionConfig = this.requireConfig();

    if (!evolutionConfig) {
      throw new ServiceUnavailableException(
        'Evolution API is not configured. Set EVOLUTION_API_URL and EVOLUTION_API_KEY on the backend.',
      );
    }

    const data = await this.request<Record<string, unknown>>(
      evolutionConfig,
      `/instance/connectionState/${encodeURIComponent(instanceName)}`,
      { method: 'GET' },
    );

    const parsed = this.parseConnectionState(data);

    this.logger.log('Evolution connection state fetched', {
      instanceName,
      state: parsed.state,
    });

    return parsed;
  }

  private parseConnectionState(data: Record<string, unknown>): EvolutionConnectionStateResult {
    const instance = (data.instance as Record<string, unknown> | undefined) ?? data;

    const rawState =
      instance.state ??
      instance.status ??
      instance.connectionStatus ??
      data.state ??
      data.status;

    const state = typeof rawState === 'string' ? rawState.toLowerCase() : 'close';

    const wuid =
      this.readString(instance.wuid) ??
      this.readString(instance.ownerJid) ??
      this.readString(data.wuid);

    const profileName =
      this.readString(instance.profileName) ??
      this.readString(instance.profile_name) ??
      this.readString(data.profileName);

    return {
      state,
      phoneNumber: this.formatPhoneNumber(wuid),
      profileName,
    };
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private formatPhoneNumber(wuid: string | null): string | null {
    if (!wuid) {
      return null;
    }

    const localPart = wuid.split('@')[0] ?? wuid;
    const digits = localPart.replace(/\D/g, '');
    if (!digits) {
      return null;
    }

    return `+${digits}`;
  }

  private extractQrBase64(data: Record<string, unknown>): string | null {
    const candidates: unknown[] = [
      data.base64,
      (data.qrcode as Record<string, unknown> | undefined)?.base64,
      (data.qr as Record<string, unknown> | undefined)?.base64,
      data.code,
      (data.qrcode as Record<string, unknown> | undefined)?.code,
    ];

    for (const candidate of candidates) {
      if (typeof candidate !== 'string' || !candidate.trim()) {
        continue;
      }

      const value = candidate.trim();
      if (value.startsWith('data:image')) {
        return value;
      }

      if (value.length > 100) {
        return `data:image/png;base64,${value}`;
      }
    }

    return null;
  }

  private async request<T>(
    evolutionConfig: EvolutionProviderConfig,
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const url = new URL(path, `${evolutionConfig.baseUrl}/`);

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          apikey: evolutionConfig.apiKey,
          ...(init.headers ?? {}),
        },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      this.logger.error('Evolution API request failed', {
        path,
        error: error instanceof Error ? error.message : error,
      });
      throw new BadGatewayException('Could not reach Evolution API');
    }

    const body = await response.text();

    if (!response.ok) {
      this.logger.error('Evolution API error', {
        path,
        status: response.status,
        body,
      });
      throw this.mapEvolutionError(response.status, body);
    }

    if (!body.trim()) {
      return {} as T;
    }

    try {
      return JSON.parse(body) as T;
    } catch {
      this.logger.error('Evolution API returned invalid JSON', { path, body });
      throw new BadGatewayException('Evolution API returned an invalid response');
    }
  }

  private mapEvolutionError(status: number, body: string): BadGatewayException {
    let message = `Evolution API request failed (${status})`;

    try {
      const parsed = JSON.parse(body) as { message?: string | string[]; error?: string };
      const detail = parsed.message ?? parsed.error;
      if (typeof detail === 'string' && detail.trim()) {
        message = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        message = detail.join(', ');
      }
    } catch {
      if (body.trim()) {
        message = body.trim().slice(0, 200);
      }
    }

    if (status === 401 || status === 403) {
      throw new ServiceUnavailableException(
        'Evolution API rejected the request. Verify EVOLUTION_API_KEY matches AUTHENTICATION_API_KEY.',
      );
    }

    if (status === 404) {
      throw new BadGatewayException('Evolution instance not found. Try creating the session again.');
    }

    return new BadGatewayException(message);
  }

  private requireConfig(): EvolutionProviderConfig | null {
    return this.getConfig();
  }

  private getConfig(): EvolutionProviderConfig | null {
    const baseUrl = this.config.get<string>('EVOLUTION_API_URL');
    const apiKey = this.config.get<string>('EVOLUTION_API_KEY');

    if (!baseUrl || !apiKey) {
      return null;
    }

    return { baseUrl: baseUrl.replace(/\/$/, ''), apiKey };
  }
}
