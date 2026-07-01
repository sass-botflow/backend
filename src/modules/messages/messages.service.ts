import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MessageDirection,
  MessageType,
  WhatsAppAccountStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
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

    const whatsappAccount = await this.prisma.whatsAppAccount.findFirst({
      where: {
        organizationId: workspaceId,
        phoneNumberId,
      },
    });

    if (!whatsappAccount) {
      throw new NotFoundException(
        'Connected WhatsApp account not found for this workspace and phone number',
      );
    }

    if (whatsappAccount.status !== WhatsAppAccountStatus.CONNECTED) {
      throw new BadRequestException(
        `WhatsApp account is not connected (status: ${whatsappAccount.status})`,
      );
    }

    const sendResult = await this.whatsAppCloudApi.sendTextMessage(
      whatsappAccount.phoneNumberId,
      whatsappAccount.accessToken,
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
