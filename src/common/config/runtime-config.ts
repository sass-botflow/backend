import { ConfigService } from '@nestjs/config';

export interface RuntimeConfigSnapshot {
  buildCommit: string;
  evolutionApiUrl: boolean;
  evolutionApiKey: boolean;
  nodeEnv: string;
}

export function getRuntimeConfigSnapshot(
  config: ConfigService,
): RuntimeConfigSnapshot {
  return {
    buildCommit: process.env.BUILD_COMMIT?.trim() || 'unknown',
    evolutionApiUrl: Boolean(config.get<string>('EVOLUTION_API_URL')?.trim()),
    evolutionApiKey: Boolean(config.get<string>('EVOLUTION_API_KEY')?.trim()),
    nodeEnv: process.env.NODE_ENV?.trim() || 'development',
  };
}

export function logRuntimeConfigStartup(snapshot: RuntimeConfigSnapshot): void {
  console.log('=== BotFlow API Startup ===');
  console.log(`Build Commit: ${snapshot.buildCommit}`);
  console.log(`EVOLUTION_API_URL exists: ${snapshot.evolutionApiUrl}`);
  console.log(`EVOLUTION_API_KEY exists: ${snapshot.evolutionApiKey}`);
  console.log(`NODE_ENV: ${snapshot.nodeEnv}`);
}

export function assertProductionRuntimeConfig(config: ConfigService): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const missing: string[] = [];

  if (!config.get<string>('EVOLUTION_API_URL')?.trim()) {
    missing.push('EVOLUTION_API_URL');
  }
  if (!config.get<string>('EVOLUTION_API_KEY')?.trim()) {
    missing.push('EVOLUTION_API_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `Production startup blocked: missing required env vars: ${missing.join(', ')}`,
    );
  }
}
