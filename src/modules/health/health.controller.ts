import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    const metaConfigured = Boolean(
      process.env.META_APP_ID?.trim() &&
        process.env.META_APP_SECRET?.trim() &&
        process.env.META_EMBEDDED_SIGNUP_CONFIG_ID?.trim(),
    );

    const whatsappReady = metaConfigured && Boolean(process.env.TOKEN_ENCRYPTION_KEY?.trim());

    return {
      status: 'ok',
      service: 'botflow-api',
      buildCommit: process.env.BUILD_COMMIT ?? 'unknown',
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
          appId: Boolean(process.env.META_APP_ID),
          appSecret: Boolean(process.env.META_APP_SECRET),
          embeddedSignupConfigId: Boolean(process.env.META_EMBEDDED_SIGNUP_CONFIG_ID),
          verifyToken: Boolean(process.env.META_VERIFY_TOKEN),
        },
        n8n: Boolean(process.env.N8N_WEBHOOK_URL),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
