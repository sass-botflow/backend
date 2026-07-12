import { ConfigService } from '@nestjs/config';

export interface RuntimeConfigSnapshot {
  buildCommit: string;
  evolutionApiUrl: boolean;
  evolutionApiKey: boolean;
  metaOAuth: boolean;
  nodeEnv: string;
}

export function getRuntimeConfigSnapshot(
  config: ConfigService,
): RuntimeConfigSnapshot {
  return {
    buildCommit: process.env.BUILD_COMMIT?.trim() || 'unknown',
    evolutionApiUrl: Boolean(config.get<string>('EVOLUTION_API_URL')?.trim()),
    evolutionApiKey: Boolean(config.get<string>('EVOLUTION_API_KEY')?.trim()),
    metaOAuth: Boolean(
      config.get<string>('META_APP_ID')?.trim() &&
        config.get<string>('META_APP_SECRET')?.trim() &&
        config.get<string>('META_REDIRECT_URI')?.trim(),
    ),
    nodeEnv: process.env.NODE_ENV?.trim() || 'development',
  };
}

export function logRuntimeConfigStartup(snapshot: RuntimeConfigSnapshot): void {
  console.log('=== BotFlow API Startup ===');
  console.log(`Build Commit: ${snapshot.buildCommit}`);
  console.log(`EVOLUTION_API_URL exists: ${snapshot.evolutionApiUrl}`);
  console.log(`EVOLUTION_API_KEY exists: ${snapshot.evolutionApiKey}`);
  console.log(`META OAuth configured: ${snapshot.metaOAuth}`);
  console.log(`NODE_ENV: ${snapshot.nodeEnv}`);
}

export function assertProductionRuntimeConfig(config: ConfigService): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const hasEvolution =
    Boolean(config.get<string>('EVOLUTION_API_URL')?.trim()) &&
    Boolean(config.get<string>('EVOLUTION_API_KEY')?.trim());

  const hasMeta =
    Boolean(config.get<string>('META_APP_ID')?.trim()) &&
    Boolean(config.get<string>('META_APP_SECRET')?.trim()) &&
    Boolean(config.get<string>('META_REDIRECT_URI')?.trim());

  if (!hasEvolution && !hasMeta) {
    throw new Error(
      'Production startup blocked: configure EVOLUTION_API_URL + EVOLUTION_API_KEY (WhatsApp) ' +
        'or META_APP_ID + META_APP_SECRET + META_REDIRECT_URI (Instagram).',
    );
  }
}
