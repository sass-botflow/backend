import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Channel, ChannelStatus } from '@prisma/client';
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

    if (!channel || !isWhatsAppChannelConnected(channel)) {
      this.logger.warn('No connected WhatsApp channel for phoneNumberId', { phoneNumberId });
      return null;
    }

    return this.toResolved(channel);
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

    if (!channel || !isWhatsAppChannelConnected(channel)) {
      throw new NotFoundException(
        'Connected WhatsApp channel not found for this workspace and phone number',
      );
    }

    return this.toResolved(channel);
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
