import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { getLastEvolutionRequestReport, getLastEvolutionStartupReport, getResolvedEvolutionBaseUrl } from '../../common/diagnostics/evolution-connectivity.util';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  check() {
    const startupConnectivity = getLastEvolutionStartupReport();
    const lastRequestConnectivity = getLastEvolutionRequestReport();
    const resolvedEvolutionUrl = getResolvedEvolutionBaseUrl();

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
      evolutionConnectivity: startupConnectivity
        ? {
            configuredBaseUrl: resolvedEvolutionUrl?.configured ?? startupConnectivity.configuredBaseUrl,
            resolvedBaseUrl: resolvedEvolutionUrl?.resolved ?? startupConnectivity.configuredBaseUrl,
            resolutionSource: resolvedEvolutionUrl?.source ?? null,
            host: startupConnectivity.host,
            port: startupConnectivity.port,
            reachable: startupConnectivity.reachable,
            dns: startupConnectivity.dns,
            tcp: startupConnectivity.tcp,
            httpHealth: startupConnectivity.httpHealth,
            suggestions: startupConnectivity.suggestions,
            alternateHostnames: startupConnectivity.alternateHostnames,
            lastRequest: lastRequestConnectivity
              ? {
                  resolvedUrl: lastRequestConnectivity.resolvedUrl,
                  host: lastRequestConnectivity.host,
                  port: lastRequestConnectivity.port,
                  dns: lastRequestConnectivity.dns,
                  tcp: lastRequestConnectivity.tcp,
                }
              : null,
          }
        : null,
      timestamp: new Date().toISOString(),
    };
  }
}
