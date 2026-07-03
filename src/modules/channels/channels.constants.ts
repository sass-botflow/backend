export const META_GRAPH_API_VERSION = 'v21.0';

export const META_EMBEDDED_SIGNUP_SCOPES = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
  'business_management',
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

export interface PublicChannel {
  id: string;
  workspaceId: string;
  provider: string;
  type: string;
  status: string;
  businessId: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  businessName: string | null;
  name: string;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}
