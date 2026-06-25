import { WhatsAppAccount, WhatsAppAccountStatus } from '@prisma/client';

export type WhatsAppAccountPublic = Omit<WhatsAppAccount, 'accessToken'> & {
  accessTokenMasked: string;
};

export function maskAccessToken(token: string): string {
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export function toPublicAccount(account: WhatsAppAccount): WhatsAppAccountPublic {
  const { accessToken, ...rest } = account;
  return {
    ...rest,
    accessTokenMasked: maskAccessToken(accessToken),
  };
}

export const META_GRAPH_VERSION = 'v21.0';

export const WHATSAPP_OAUTH_SCOPES = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
  'business_management',
].join(',');
