export const META_GRAPH_API_VERSION = 'v21.0';

export const META_EMBEDDED_SIGNUP_SCOPES = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
  'business_management',
].join(',');

export interface MetaCallbackResult {
  accessToken: string;
  expiresIn: number | null;
  workspaceId: string;
}
