import { Injectable, Logger } from '@nestjs/common';
import {
  ContactSource,
  ConversationStatus,
  MessageDirection,
  MessageType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ChannelResolverService } from '../channels/channel-resolver.service';
import { MetaWebhookParser } from './meta-webhook.parser';
import {
  N8nForwardPayload,
  ParsedInboundWhatsAppMessage,
} from './meta-webhook.types';
import { N8nForwarderService } from './n8n-forwarder.service';

export interface PersistedInboundMessage {
  workspaceId: string;
  conversationId: string;
  inbound: ParsedInboundWhatsAppMessage;
}

@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly n8nForwarder: N8nForwarderService,
    private readonly channelResolver: ChannelResolverService,
  ) {}

  async processWebhookPayload(payload: unknown): Promise<void> {
    this.logger.log('Processing Meta webhook payload');

    const inboundMessages = MetaWebhookParser.parseInboundMessages(payload);

    if (inboundMessages.length === 0) {
      this.logger.debug('No supported inbound WhatsApp messages to process');
      return;
    }

    for (const inbound of inboundMessages) {
      try {
        await this.processInboundMessage(inbound);
      } catch (error) {
        this.logger.error('Failed to process inbound WhatsApp message', {
          messageId: inbound.messageId,
          phoneNumberId: inbound.phoneNumberId,
          error: error instanceof Error ? error.message : error,
        });
      }
    }
  }

  private async processInboundMessage(inbound: ParsedInboundWhatsAppMessage): Promise<void> {
    const existing = await this.prisma.message.findUnique({
      where: { externalId: inbound.messageId },
      select: { id: true, conversationId: true },
    });

    if (existing) {
      this.logger.debug(`Duplicate WhatsApp message ignored: ${inbound.messageId}`);
      return;
    }

    const resolvedChannel = await this.channelResolver.resolveByPhoneNumberId(
      inbound.phoneNumberId,
    );

    if (!resolvedChannel) {
      this.logger.warn('No connected WhatsApp channel found for phoneNumberId', {
        phoneNumberId: inbound.phoneNumberId,
        messageId: inbound.messageId,
      });
      return;
    }

    this.logger.log('Resolved workspace from phoneNumberId', {
      workspaceId: resolvedChannel.workspaceId,
      channelId: resolvedChannel.id,
      phoneNumberId: inbound.phoneNumberId,
      messageId: inbound.messageId,
    });

    const persisted = await this.persistInboundMessage(
      resolvedChannel.workspaceId,
      resolvedChannel.id,
      inbound,
    );

    const n8nPayload: N8nForwardPayload = {
      workspaceId: persisted.workspaceId,
      conversationId: persisted.conversationId,
      phoneNumberId: inbound.phoneNumberId,
      customerPhone: inbound.customerPhone,
      customerName: inbound.customerName,
      message: inbound.messageText,
      messageId: inbound.messageId,
      timestamp: inbound.timestamp.toISOString(),
    };

    await this.n8nForwarder.forward(n8nPayload);
  }

  private async persistInboundMessage(
    workspaceId: string,
    channelId: string,
    inbound: ParsedInboundWhatsAppMessage,
  ): Promise<PersistedInboundMessage> {
    return this.prisma.$transaction(async (tx) => {
      let contact = await tx.contact.findFirst({
        where: {
          organizationId: workspaceId,
          phone: inbound.customerPhone,
        },
      });

      if (!contact) {
        contact = await tx.contact.create({
          data: {
            organizationId: workspaceId,
            name: inbound.customerName,
            phone: inbound.customerPhone,
            source: ContactSource.WHATSAPP,
          },
        });
      } else if (contact.name !== inbound.customerName && inbound.customerName) {
        contact = await tx.contact.update({
          where: { id: contact.id },
          data: { name: inbound.customerName },
        });
      }

      let conversation = await tx.conversation.findFirst({
        where: {
          organizationId: workspaceId,
          contactId: contact.id,
          channelId,
          status: { in: [ConversationStatus.OPEN, ConversationStatus.PENDING] },
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (!conversation) {
        conversation = await tx.conversation.create({
          data: {
            organizationId: workspaceId,
            contactId: contact.id,
            channelId,
            status: ConversationStatus.OPEN,
            lastMessageAt: inbound.timestamp,
          },
        });
      }

      await tx.message.create({
        data: {
          conversationId: conversation.id,
          content: inbound.messageText,
          type: MessageType.TEXT,
          direction: MessageDirection.INBOUND,
          externalId: inbound.messageId,
          metadata: {
            phoneNumberId: inbound.phoneNumberId,
            customerPhone: inbound.customerPhone,
            channelId,
          },
          createdAt: inbound.timestamp,
        },
      });

      await tx.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: inbound.timestamp },
      });

      return {
        workspaceId,
        conversationId: conversation.id,
        inbound,
      };
    });
  }
}
