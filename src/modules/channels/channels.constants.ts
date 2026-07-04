export const META_GRAPH_API_VERSION = 'v21.0';

export const WHATSAPP_PROVIDER = 'whatsapp';

/** Canonical OAuth redirect URI — must match Meta App / Facebook Login for Business config. */
export const META_WHATSAPP_OAUTH_REDIRECT_URI =
  'https://api.botflow.ink/api/channels/whatsapp/callback';

/** @deprecated Legacy redirect — ignored when resolving OAuth redirect_uri */
export const LEGACY_META_OAUTH_REDIRECT_URI = 'https://api.botflow.ink/meta/callback';

export const META_EMBEDDED_SIGNUP_SCOPES = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
].join(',');

export const META_WEBHOOK_SUBSCRIBED_FIELDS = [
  'messages',
  'message_template_status_update',
].join(',');

export const GRAPH_API_MAX_RETRIES = 3;

export interface MetaTokenExchangeResult {
  accessToken: string;
  expiresIn: number | null;
}

export interface DiscoveredWhatsAppChannel {
  businessId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  businessName: string;
}

export interface WhatsAppOAuthResult {
  connected: true;
  channelId: string;
  workspaceId: string;
  phoneNumberId: string;
  wabaId: string;
  businessId: string;
}

export interface OAuthConnectDebug {
  envMetaRedirectUri: string;
  envMetaWhatsappRedirectUri: string;
  redirectUriUsed: string;
  facebookOAuthUrl: string;
}

export interface PublicChannel {
  id: string;
  workspaceId: string;
  provider: string;
  status: string;
  businessId: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string | null;
  businessName: string | null;
  createdAt: string;
  updatedAt: string;
}
