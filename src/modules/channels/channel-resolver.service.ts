import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Channel, ChannelStatus, WhatsAppAccountStatus } from '@prisma/client';
import { TokenEncryptionService } from '../../common/crypto/token-encryption.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WHATSAPP_PROVIDER } from './channels.constants';
import { isWhatsAppChannelConnected } from './channels.mapper';

export interface ResolvedWhatsAppChannel {
  id: string;
  workspaceId: string;
  phoneNumberId: string;
  wabaId: string;
  businessId: string | null;
  accessToken: string;
  channel: Channel;
}

@Injectable()
export class ChannelResolverService {
  private readonly logger = new Logger(ChannelResolverService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async resolveByPhoneNumberId(phoneNumberId: string): Promise<ResolvedWhatsAppChannel | null> {
    const channel = await this.prisma.channel.findFirst({
      where: {
        phoneNumberId,
        provider: WHATSAPP_PROVIDER,
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
        workspaceId: legacy.organizationId,
        provider: WHATSAPP_PROVIDER,
        phoneNumberId: legacy.phoneNumberId,
        wabaId: legacy.wabaId,
        businessId: '',
        displayPhoneNumber: legacy.displayPhoneNumber,
        businessName: legacy.businessName,
        encryptedAccessToken: null,
        status: ChannelStatus.CONNECTED,
        createdAt: legacy.createdAt,
        updatedAt: legacy.updatedAt,
      },
    };
  }

  async resolveForWorkspace(
    workspaceId: string,
    phoneNumberId: string,
  ): Promise<ResolvedWhatsAppChannel> {
    const channel = await this.prisma.channel.findFirst({
      where: {
        workspaceId,
        phoneNumberId,
        provider: WHATSAPP_PROVIDER,
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
      channel: {
        id: legacy.id,
        workspaceId: legacy.organizationId,
        provider: WHATSAPP_PROVIDER,
        phoneNumberId: legacy.phoneNumberId,
        wabaId: legacy.wabaId,
        businessId: '',
        displayPhoneNumber: legacy.displayPhoneNumber,
        businessName: legacy.businessName,
        encryptedAccessToken: null,
        status: ChannelStatus.CONNECTED,
        createdAt: legacy.createdAt,
        updatedAt: legacy.updatedAt,
      },
    };
  }

  decryptAccessToken(channel: Channel): string {
    if (!channel.encryptedAccessToken) {
      throw new NotFoundException('Channel has no stored access token');
    }
    return this.encryption.decrypt(channel.encryptedAccessToken);
  }

  private toResolved(channel: Channel): ResolvedWhatsAppChannel {
    return {
      id: channel.id,
      workspaceId: channel.workspaceId,
      phoneNumberId: channel.phoneNumberId,
      wabaId: channel.wabaId,
      businessId: channel.businessId,
      accessToken: this.decryptAccessToken(channel),
      channel,
    };
  }
}
