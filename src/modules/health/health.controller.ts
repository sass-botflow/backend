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

    const isOldImage = runtime.buildCommit === 'v1.0.0-mr84xgy9';

    const deployOk =
      !isOldImage &&
      whatsappReady &&
      evolutionReachable;

    let deployHint: string | undefined;
    if (isOldImage) {
      deployHint =
        'Backend image is OLD (v1.0.0-mr84xgy9). EasyPanel → Source → GitHub + Dockerfile → main → Deploy (wait 10 min). See DEPLOY-MKHDAMCH.md';
    } else if (!whatsappReady) {
      deployHint =
        'Set EVOLUTION_API_URL + EVOLUTION_API_KEY in EasyPanel Environment, then redeploy.';
    } else if (!evolutionReachable) {
      deployHint =
        'Evolution API unreachable. EasyPanel → botflow-evolution → Start. Check EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080';
    }

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
      deployHint,
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
