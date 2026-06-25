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

export function isConnectedStatus(status: WhatsAppAccountStatus): boolean {
  return status === WhatsAppAccountStatus.CONNECTED;
}
