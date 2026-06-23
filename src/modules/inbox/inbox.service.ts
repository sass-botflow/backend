import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageDirection, MessageType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class InboxService {
  constructor(private readonly prisma: PrismaService) {}

  listConversations(organizationId: string, status?: ConversationStatus) {
    return this.prisma.conversation.findMany({
      where: { organizationId, ...(status && { status }) },
      include: {
        contact: { include: { tags: true } },
        channel: true,
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        tags: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  async getConversation(organizationId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, organizationId },
      include: {
        contact: { include: { tags: true } },
        channel: true,
        assignedTo: { select: { id: true, name: true, avatarUrl: true } },
        tags: true,
        notes: { include: { author: { select: { id: true, name: true } } } },
        comments: { include: { author: { select: { id: true, name: true } } } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async sendMessage(organizationId: string, conversationId: string, content: string) {
    await this.ensureConversation(organizationId, conversationId);
    const message = await this.prisma.message.create({
      data: {
        content,
        direction: MessageDirection.OUTBOUND,
        type: MessageType.TEXT,
        conversationId,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
    return message;
  }

  async assignConversation(organizationId: string, id: string, agentId: string) {
    await this.ensureConversation(organizationId, id);
    return this.prisma.conversation.update({
      where: { id },
      data: { assignedToId: agentId },
      include: { assignedTo: { select: { id: true, name: true } } },
    });
  }

  async addNote(organizationId: string, conversationId: string, authorId: string, content: string) {
    await this.ensureConversation(organizationId, conversationId);
    return this.prisma.conversationNote.create({
      data: { content, conversationId, authorId },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  private async ensureConversation(organizationId: string, id: string) {
    const c = await this.prisma.conversation.findFirst({ where: { id, organizationId } });
    if (!c) throw new NotFoundException('Conversation not found');
    return c;
  }
}
