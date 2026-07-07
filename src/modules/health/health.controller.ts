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
      Boolean(this.config.get<string>('META_APP_ID')?.trim()) &&
      Boolean(this.config.get<string>('META_APP_SECRET')?.trim()) &&
      runtime.embeddedSignupConfigId &&
      Boolean(this.config.get<string>('TOKEN_ENCRYPTION_KEY')?.trim());

    return {
      status: 'ok',
      service: 'botflow-api',
      buildCommit: runtime.buildCommit,
      embeddedSignupConfigId: runtime.embeddedSignupConfigId,
      modules: {
        channels: true,
        whatsapp: true,
      },
      whatsappReady,
      config: {
        database: Boolean(process.env.DATABASE_URL),
        jwt: Boolean(process.env.JWT_SECRET),
        tokenEncryption: Boolean(process.env.TOKEN_ENCRYPTION_KEY),
        meta: {
          appId: Boolean(this.config.get<string>('META_APP_ID')?.trim()),
          appSecret: Boolean(this.config.get<string>('META_APP_SECRET')?.trim()),
          embeddedSignupConfigId: runtime.embeddedSignupConfigId,
          verifyToken: Boolean(this.config.get<string>('META_VERIFY_TOKEN')?.trim()),
        },
        n8n: Boolean(this.config.get<string>('N8N_WEBHOOK_URL')?.trim()),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
