import { ConfigService } from '@nestjs/config';
import type { InstagramOAuthFlow } from './instagram.types';

/** Facebook Login — requires IG linked to a Facebook Page */
const FACEBOOK_OAUTH_SCOPES = [
  'instagram_basic',
  'pages_show_list',
  'instagram_manage_messages',
  'pages_read_engagement',
  'business_management',
] as const;

/**
 * Instagram Login — works for Professional accounts (Creator or Business)
 * without requiring a linked Facebook Page.
 */
const INSTAGRAM_LOGIN_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
] as const;

export interface MetaConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  graphApiVersion: string;
  frontendUrl: string;
  facebookScopes: string;
  instagramLoginScopes: string;
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
    facebookScopes: FACEBOOK_OAUTH_SCOPES.join(','),
    instagramLoginScopes: INSTAGRAM_LOGIN_SCOPES.join(','),
  };
}

export function resolveOAuthFlow(
  value: string | undefined,
  config: ConfigService,
): InstagramOAuthFlow {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'facebook' || normalized === 'fb') {
    return 'facebook';
  }
  if (normalized === 'instagram' || normalized === 'ig') {
    return 'instagram';
  }

  const envDefault = config.get<string>('INSTAGRAM_OAUTH_FLOW')?.trim().toLowerCase();
  if (envDefault === 'facebook' || envDefault === 'fb') {
    return 'facebook';
  }

  return 'instagram';
}
