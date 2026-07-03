import { ChannelConnection, ChannelStatus, ChannelType } from '@prisma/client';
import { PublicChannel } from './channels.constants';

export function toPublicChannel(channel: ChannelConnection): PublicChannel {
  return {
    id: channel.id,
    workspaceId: channel.organizationId,
    provider: channel.provider,
    type: channel.type,
    status: channel.status,
    businessId: channel.businessId,
    wabaId: channel.wabaId,
    phoneNumberId: channel.phoneNumberId,
    displayPhoneNumber: channel.displayPhoneNumber,
    businessName: channel.businessName,
    name: channel.name,
    connectedAt: channel.connectedAt?.toISOString() ?? null,
    tokenExpiresAt: channel.tokenExpiresAt?.toISOString() ?? null,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

export function isWhatsAppChannelConnected(channel: ChannelConnection): boolean {
  return (
    channel.type === ChannelType.WHATSAPP &&
    channel.status === ChannelStatus.CONNECTED &&
    Boolean(channel.encryptedAccessToken) &&
    Boolean(channel.phoneNumberId)
  );
}
