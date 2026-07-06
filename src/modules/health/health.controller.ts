import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  cacheResolvedEvolutionBaseUrl,
  getLastEvolutionRequestReport,
  getLastEvolutionStartupReport,
  getResolvedEvolutionBaseUrl,
} from '../../common/diagnostics/evolution-connectivity.util';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get('evolution')
  async evolution() {
    const baseUrl = process.env.EVOLUTION_API_URL?.trim();
    const apiKey = process.env.EVOLUTION_API_KEY?.trim();

    if (!baseUrl || !apiKey) {
      return {
        configured: false,
        reachable: false,
        message: 'Set EVOLUTION_API_URL and EVOLUTION_API_KEY on the backend.',
        timestamp: new Date().toISOString(),
      };
    }

    const { baseUrl: resolvedBaseUrl, source, report } = await cacheResolvedEvolutionBaseUrl(baseUrl);
    const resolved = getResolvedEvolutionBaseUrl();

    return {
      configured: true,
      configuredBaseUrl: baseUrl,
      resolvedBaseUrl,
      resolutionSource: resolved?.source ?? source,
      reachable: report.reachable,
      host: report.host,
      port: report.port,
      dns: report.dns,
      tcp: report.tcp,
      httpHealth: report.httpHealth,
      httpRoot: report.httpRoot,
      alternateHostnames: report.alternateHostnames,
      suggestions: report.suggestions,
      lastRequest: getLastEvolutionRequestReport(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  check() {
    const startupConnectivity = getLastEvolutionStartupReport();
    const lastRequestConnectivity = getLastEvolutionRequestReport();
    const resolvedEvolutionUrl = getResolvedEvolutionBaseUrl();
    const evolutionConfigured = Boolean(
      process.env.EVOLUTION_API_URL?.trim() && process.env.EVOLUTION_API_KEY?.trim(),
    );

    return {
      status: 'ok',
      service: 'botflow-api',
      buildCommit: process.env.BUILD_COMMIT ?? 'unknown',
      modules: {
        channels: true,
        whatsapp: true,
      },
      evolution: {
        configured: evolutionConfigured,
        reachable: startupConnectivity?.reachable ?? null,
        configuredBaseUrl: process.env.EVOLUTION_API_URL?.trim() ?? null,
        resolvedBaseUrl: resolvedEvolutionUrl?.resolved ?? null,
        resolutionSource: resolvedEvolutionUrl?.source ?? null,
      },
      config: {
        database: Boolean(process.env.DATABASE_URL),
        jwt: Boolean(process.env.JWT_SECRET),
        tokenEncryption: Boolean(process.env.TOKEN_ENCRYPTION_KEY),
        evolution: evolutionConfigured,
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
