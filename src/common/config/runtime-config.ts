import { ConfigService } from '@nestjs/config';

export interface RuntimeConfigSnapshot {
  buildCommit: string;
  metaAppId: string;
  embeddedSignupConfigId: boolean;
  nodeEnv: string;
}

export function getRuntimeConfigSnapshot(
  config: ConfigService,
): RuntimeConfigSnapshot {
  return {
    buildCommit: process.env.BUILD_COMMIT?.trim() || 'unknown',
    metaAppId: config.get<string>('META_APP_ID')?.trim() ?? '',
    embeddedSignupConfigId: Boolean(
      config.get<string>('META_EMBEDDED_SIGNUP_CONFIG_ID')?.trim(),
    ),
    nodeEnv: process.env.NODE_ENV?.trim() || 'development',
  };
}

export function logRuntimeConfigStartup(snapshot: RuntimeConfigSnapshot): void {
  console.log('=== BotFlow API Startup ===');
  console.log(`Build Commit: ${snapshot.buildCommit}`);
  console.log(`META_APP_ID: ${snapshot.metaAppId || '(not set)'}`);
  console.log(
    `META_EMBEDDED_SIGNUP_CONFIG_ID exists: ${snapshot.embeddedSignupConfigId}`,
  );
  console.log(`NODE_ENV: ${snapshot.nodeEnv}`);
}

export function assertProductionRuntimeConfig(config: ConfigService): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const missing: string[] = [];

  if (!config.get<string>('META_EMBEDDED_SIGNUP_CONFIG_ID')?.trim()) {
    missing.push('META_EMBEDDED_SIGNUP_CONFIG_ID');
  }
  if (!config.get<string>('META_APP_ID')?.trim()) {
    missing.push('META_APP_ID');
  }
  if (!config.get<string>('META_APP_SECRET')?.trim()) {
    missing.push('META_APP_SECRET');
  }
  if (!config.get<string>('TOKEN_ENCRYPTION_KEY')?.trim()) {
    missing.push('TOKEN_ENCRYPTION_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `Production startup blocked: missing required env vars: ${missing.join(', ')}`,
    );
  }
}
