import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { getRuntimeConfigSnapshot } from '../../common/config/runtime-config';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check() {
    const runtime = getRuntimeConfigSnapshot(this.config);

    const whatsappReady =
      runtime.evolutionApiUrl && runtime.evolutionApiKey;

    return {
      status: 'ok',
      service: 'botflow-api',
      buildCommit: runtime.buildCommit,
      modules: {
        whatsapp: true,
        instagram: true,
      },
      whatsappReady,
      instagramReady: runtime.metaOAuth,
      deployOk: runtime.buildCommit !== 'v1.0.0-mr84xgy9',
      config: {
        database: Boolean(process.env.DATABASE_URL),
        jwt: Boolean(process.env.JWT_SECRET),
        evolution: {
          apiUrl: runtime.evolutionApiUrl,
          apiKey: runtime.evolutionApiKey,
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
