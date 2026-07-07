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

/** Canonical Meta webhook URL — configure once in Meta App Dashboard. */
export const META_WHATSAPP_WEBHOOK_URL =
  'https://api.botflow.ink/api/channels/whatsapp/webhook';

export const META_WEBHOOK_SUBSCRIBED_FIELDS = [
  'messages',
  'message_status',
  'message_template_status_update',
  'phone_number_name_update',
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

export const EMBEDDED_SIGNUP_STEPS = [
  'exchange_code',
  'discover_business',
  'discover_waba',
  'discover_phone',
  'subscribe_webhooks',
  'save_credentials',
  'connected',
] as const;

export type EmbeddedSignupStep = (typeof EMBEDDED_SIGNUP_STEPS)[number];

export type EmbeddedSignupStepStatus = 'completed' | 'failed' | 'skipped';

export type EmbeddedSignupScenario =
  | 'existing_business'
  | 'existing_waba'
  | 'existing_phone'
  | 'new_setup';

export interface EmbeddedSignupProgressStep {
  step: EmbeddedSignupStep;
  status: EmbeddedSignupStepStatus;
  message?: string;
}

export interface WhatsAppOAuthResult {
  connected: true;
  channelId: string;
  workspaceId: string;
  phoneNumberId: string;
  wabaId: string;
  businessId: string;
  steps: EmbeddedSignupProgressStep[];
  scenario: EmbeddedSignupScenario;
}

export interface EmbeddedSignupDiscoveryContext {
  businessId?: string;
  businessName?: string;
  wabaId?: string;
  phoneNumberId?: string;
  scenario: EmbeddedSignupScenario;
}

export interface EmbeddedSignupDiscoveryState {
  context: EmbeddedSignupDiscoveryContext;
  businessId: string;
  businessName: string;
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  scenario: EmbeddedSignupScenario;
}

export interface EmbeddedSignupConnectConfig {
  appId: string;
  configId: string;
  state: string;
}

export interface WhatsAppPhoneNumberDetails {
  id: string;
  displayPhoneNumber: string;
  verifiedName: string;
  status: string;
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
