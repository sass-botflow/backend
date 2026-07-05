import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'botflow-api',
      buildCommit: process.env.BUILD_COMMIT ?? 'unknown',
      modules: {
        channels: true,
      },
      config: {
        database: Boolean(process.env.DATABASE_URL),
        jwt: Boolean(process.env.JWT_SECRET),
        tokenEncryption: Boolean(process.env.TOKEN_ENCRYPTION_KEY),
        evolution: Boolean(
          process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY,
        ),
        meta: {
          appId: Boolean(process.env.META_APP_ID),
          appSecret: Boolean(process.env.META_APP_SECRET),
          embeddedSignupConfigId: Boolean(process.env.META_EMBEDDED_SIGNUP_CONFIG_ID),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}
