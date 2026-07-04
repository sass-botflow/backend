export const META_GRAPH_API_VERSION = 'v21.0';

export const META_EMBEDDED_SIGNUP_SCOPES = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
].join(',');

export const META_WEBHOOK_SUBSCRIBED_FIELDS = [
  'messages',
  'message_template_status_update',
].join(',');

export interface MetaConnectionResult {
  connected: true;
  workspaceId: string;
  phoneNumberId: string;
  wabaId: string;
}

export interface DiscoveredWhatsAppAccount {
  wabaId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName: string;
  businessName: string;
}

export interface MetaTokenExchangeResult {
  accessToken: string;
  expiresIn: number | null;
}
