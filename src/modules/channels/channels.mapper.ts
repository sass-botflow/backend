import { Channel, ChannelStatus } from '@prisma/client';
import { PublicChannel, WHATSAPP_PROVIDER } from './channels.constants';

export function toPublicChannel(channel: Channel): PublicChannel {
  return {
    id: channel.id,
    workspaceId: channel.workspaceId,
    provider: channel.provider,
    status: channel.status,
    businessId: channel.businessId,
    wabaId: channel.wabaId,
    phoneNumberId: channel.phoneNumberId,
    displayPhoneNumber: channel.displayPhoneNumber,
    businessName: channel.businessName,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

export function isWhatsAppChannelConnected(channel: Channel): boolean {
  return (
    channel.provider === WHATSAPP_PROVIDER &&
    channel.status === ChannelStatus.CONNECTED &&
    Boolean(channel.encryptedAccessToken) &&
    Boolean(channel.phoneNumberId)
  );
}
