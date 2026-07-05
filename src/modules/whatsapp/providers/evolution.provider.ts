import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
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
    const evolutionConfig = this.getConfig();

    if (!evolutionConfig) {
      this.logger.warn('Evolution API not configured — returning mocked createInstance success', {
        instanceName,
      });
      return { instanceName, mocked: true };
    }

    const url = new URL('/instance/create', evolutionConfig.baseUrl);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evolutionConfig.apiKey,
      },
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error('Evolution API createInstance failed', {
        instanceName,
        status: response.status,
        body,
      });
      throw new Error(`Evolution API createInstance failed (${response.status})`);
    }

    this.logger.log('Evolution instance created', { instanceName });

    return { instanceName, mocked: false };
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
