import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { getRuntimeConfigSnapshot } from '../../common/config/runtime-config';
import { EvolutionApiService } from '../whatsapp/evolution-api.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    private readonly evolution: EvolutionApiService,
  ) {}

  @Get()
  async check() {
    const runtime = getRuntimeConfigSnapshot(this.config);

    const whatsappReady =
      runtime.evolutionApiUrl && runtime.evolutionApiKey;

    const evolutionReachable = whatsappReady ? await this.evolution.ping() : false;

    const deployOk =
      runtime.buildCommit !== 'v1.0.0-mr84xgy9' &&
      whatsappReady &&
      evolutionReachable;

    return {
      status: deployOk ? 'ok' : 'degraded',
      service: 'botflow-api',
      buildCommit: runtime.buildCommit,
      modules: {
        whatsapp: true,
        instagram: true,
      },
      whatsappReady,
      evolutionReachable,
      instagramReady: runtime.metaOAuth,
      deployOk,
      config: {
        database: Boolean(process.env.DATABASE_URL),
        jwt: Boolean(process.env.JWT_SECRET),
        evolution: {
          apiUrl: runtime.evolutionApiUrl,
          apiKey: runtime.evolutionApiKey,
          reachable: evolutionReachable,
        },
        meta: {
          oauth: runtime.metaOAuth,
        },
        n8n: Boolean(this.config.get<string>('N8N_WEBHOOK_URL')?.trim()),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
