import { ConfigService } from '@nestjs/config';

const INSTAGRAM_OAUTH_SCOPES = [
  'instagram_basic',
  'pages_show_list',
  'instagram_manage_messages',
  'business_management',
] as const;

export interface MetaConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  graphApiVersion: string;
  frontendUrl: string;
  scopes: string;
}

export function getMetaConfig(config: ConfigService): MetaConfig | null {
  const appId = config.get<string>('META_APP_ID')?.trim();
  const appSecret = config.get<string>('META_APP_SECRET')?.trim();
  const backendUrl = config.get<string>('BACKEND_URL')?.trim()?.replace(/\/$/, '');
  const redirectUri =
    config.get<string>('META_REDIRECT_URI')?.trim() ||
    (backendUrl ? `${backendUrl}/api/auth/instagram/callback` : '');

  if (!appId || !appSecret || !redirectUri) {
    return null;
  }

  return {
    appId,
    appSecret,
    redirectUri,
    graphApiVersion: config.get<string>('META_GRAPH_API_VERSION')?.trim() || 'v21.0',
    frontendUrl: config.get<string>('FRONTEND_URL')?.trim() || 'https://www.botflow.ink',
    scopes: INSTAGRAM_OAUTH_SCOPES.join(','),
  };
}
