import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MessageDirection,
  MessageType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChannelResolverService } from '../channels/channel-resolver.service';
import { SendMessageDto } from './dto/send-message.dto';
import { WhatsAppCloudApiService } from './whatsapp-cloud-api.service';

export interface SendMessageResult {
  success: true;
  workspaceId: string;
  conversationId: string;
  messageId: string;
  whatsappMessageId: string;
  phoneNumberId: string;
  recipientPhone: string;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppCloudApi: WhatsAppCloudApiService,
    private readonly channelResolver: ChannelResolverService,
  ) {}

  async sendOutboundMessage(dto: SendMessageDto): Promise<SendMessageResult> {
    const { workspaceId, conversationId, phoneNumberId, message } = dto;

    this.logger.log('Processing outbound WhatsApp message request', {
      workspaceId,
      conversationId,
      phoneNumberId,
    });

    await this.validateWorkspace(workspaceId);

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId: workspaceId,
      },
      include: {
        contact: {
          select: { phone: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found for the provided workspace',
      );
    }

    const customerPhone = conversation.contact.phone?.trim();
    if (!customerPhone) {
      throw new BadRequestException(
        'Conversation contact does not have a phone number',
      );
    }

    const resolvedChannel = await this.channelResolver.resolveForWorkspace(
      workspaceId,
      phoneNumberId,
    );

    const sendResult = await this.whatsAppCloudApi.sendTextMessage(
      resolvedChannel.phoneNumberId,
      resolvedChannel.accessToken,
      customerPhone,
      message,
    );

    const savedMessage = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: {
          conversationId,
          content: message,
          type: MessageType.TEXT,
          direction: MessageDirection.OUTBOUND,
          externalId: sendResult.whatsappMessageId,
          metadata: {
            phoneNumberId,
            customerPhone: sendResult.recipientWaId,
            channelId: resolvedChannel.id,
            source: 'whatsapp_cloud_api',
          },
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      return created;
    });

    this.logger.log('Outbound WhatsApp message saved', {
      workspaceId,
      conversationId,
      messageId: savedMessage.id,
      whatsappMessageId: sendResult.whatsappMessageId,
      channelId: resolvedChannel.id,
    });

    return {
      success: true,
      workspaceId,
      conversationId,
      messageId: savedMessage.id,
      whatsappMessageId: sendResult.whatsappMessageId,
      phoneNumberId,
      recipientPhone: sendResult.recipientWaId,
    };
  }

  private async validateWorkspace(workspaceId: string): Promise<void> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Workspace not found');
    }
  }
}
