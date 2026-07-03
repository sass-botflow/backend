import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ChannelConnection, ChannelStatus, ChannelType, WhatsAppAccountStatus } from '@prisma/client';
import { TokenEncryptionService } from '../../common/crypto/token-encryption.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { isWhatsAppChannelConnected } from './channels.mapper';

export interface ResolvedWhatsAppChannel {
  id: string;
  workspaceId: string;
  phoneNumberId: string;
  wabaId: string;
  businessId: string | null;
  accessToken: string;
  channel: ChannelConnection;
}

@Injectable()
export class ChannelResolverService {
  private readonly logger = new Logger(ChannelResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async resolveByPhoneNumberId(phoneNumberId: string): Promise<ResolvedWhatsAppChannel | null> {
    const channel = await this.prisma.channelConnection.findFirst({
      where: {
        phoneNumberId,
        type: ChannelType.WHATSAPP,
        status: ChannelStatus.CONNECTED,
      },
    });

    if (channel && isWhatsAppChannelConnected(channel)) {
      return this.toResolved(channel);
    }

    const legacy = await this.prisma.whatsAppAccount.findFirst({
      where: {
        phoneNumberId,
        status: WhatsAppAccountStatus.CONNECTED,
      },
    });

    if (!legacy) {
      this.logger.warn('No connected WhatsApp channel for phoneNumberId', { phoneNumberId });
      return null;
    }

    this.logger.debug('Resolved legacy WhatsAppAccount for phoneNumberId', { phoneNumberId });

    return {
      id: legacy.id,
      workspaceId: legacy.organizationId,
      phoneNumberId: legacy.phoneNumberId,
      wabaId: legacy.wabaId,
      businessId: null,
      accessToken: legacy.accessToken,
      channel: {
        id: legacy.id,
        organizationId: legacy.organizationId,
        phoneNumberId: legacy.phoneNumberId,
      } as ChannelConnection,
    };
  }

  async resolveForWorkspace(
    workspaceId: string,
    phoneNumberId: string,
  ): Promise<ResolvedWhatsAppChannel> {
    const channel = await this.prisma.channelConnection.findFirst({
      where: {
        organizationId: workspaceId,
        phoneNumberId,
        type: ChannelType.WHATSAPP,
      },
    });

    if (channel && isWhatsAppChannelConnected(channel)) {
      return this.toResolved(channel);
    }

    const legacy = await this.prisma.whatsAppAccount.findFirst({
      where: {
        organizationId: workspaceId,
        phoneNumberId,
        status: WhatsAppAccountStatus.CONNECTED,
      },
    });

    if (!legacy) {
      throw new NotFoundException(
        'Connected WhatsApp channel not found for this workspace and phone number',
      );
    }

    return {
      id: legacy.id,
      workspaceId: legacy.organizationId,
      phoneNumberId: legacy.phoneNumberId,
      wabaId: legacy.wabaId,
      businessId: null,
      accessToken: legacy.accessToken,
      channel: { id: legacy.id, organizationId: legacy.organizationId } as ChannelConnection,
    };
  }

  decryptAccessToken(channel: ChannelConnection): string {
    if (!channel.encryptedAccessToken) {
      throw new NotFoundException('Channel has no stored access token');
    }
    return this.encryption.decrypt(channel.encryptedAccessToken);
  }

  private toResolved(channel: ChannelConnection): ResolvedWhatsAppChannel {
    return {
      id: channel.id,
      workspaceId: channel.organizationId,
      phoneNumberId: channel.phoneNumberId!,
      wabaId: channel.wabaId!,
      businessId: channel.businessId,
      accessToken: this.decryptAccessToken(channel),
      channel,
    };
  }
}
