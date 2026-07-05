import { Logger } from '@nestjs/common';
import { cacheResolvedEvolutionBaseUrl } from './evolution-connectivity.util';

const logger = new Logger('EvolutionStartupDiagnostics');

export async function registerEvolutionStartupDiagnostics(): Promise<void> {
  const baseUrl = process.env.EVOLUTION_API_URL?.trim();
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    logger.warn('Evolution API env not configured — skipping startup connectivity diagnostics', {
      hasUrl: Boolean(baseUrl),
      hasKey: Boolean(apiKey),
    });
    return;
  }

  logger.log('Running Evolution API startup connectivity diagnostics', { baseUrl });

  try {
    const { baseUrl: resolvedBaseUrl, source, report } = await cacheResolvedEvolutionBaseUrl(baseUrl);

    const payload = {
      configuredBaseUrl: report.configuredBaseUrl,
      resolvedBaseUrl,
      resolutionSource: source,
      host: report.host,
      port: report.port,
      dns: report.dns,
      tcp: report.tcp,
      httpHealth: report.httpHealth,
      httpRoot: report.httpRoot,
      reachable: report.reachable,
      alternateHostnames: report.alternateHostnames,
      suggestions: report.suggestions,
    };

    if (report.reachable) {
      logger.log('Evolution API startup connectivity OK', payload);
      console.log('[INFO] Evolution API startup connectivity OK', JSON.stringify(payload));
      return;
    }

    logger.error('Evolution API startup connectivity FAILED', payload);
    console.error('[ERROR] Evolution API startup connectivity FAILED', JSON.stringify(payload));
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    logger.error('Evolution API startup diagnostics crashed', message);
    console.error('[ERROR] Evolution API startup diagnostics crashed', message);
  }
}
