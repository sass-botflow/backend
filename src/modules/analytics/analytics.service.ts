import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(organizationId: string) {
    const [
      totalContacts,
      openConversations,
      totalBots,
      appointments,
      deals,
      messages,
    ] = await Promise.all([
      this.prisma.contact.count({ where: { organizationId } }),
      this.prisma.conversation.count({ where: { organizationId, status: 'OPEN' } }),
      this.prisma.bot.count({ where: { organizationId, status: 'ACTIVE' } }),
      this.prisma.appointment.count({ where: { organizationId } }),
      this.prisma.deal.findMany({
        where: { contact: { organizationId } },
        select: { value: true },
      }),
      this.prisma.message.count({
        where: { conversation: { organizationId } },
      }),
    ]);

    const revenue = deals.reduce((sum, d) => sum + d.value, 0);
    const conversionRate = totalContacts > 0
      ? Math.round((deals.length / totalContacts) * 100)
      : 0;

    return {
      revenue,
      leads: totalContacts,
      conversations: openConversations,
      conversionRate,
      responseTime: '< 2 min',
      activeBots: totalBots,
      appointments,
      totalMessages: messages,
      charts: {
        leadsByWeek: await this.leadsByWeek(organizationId),
        conversationsByChannel: await this.conversationsByChannel(organizationId),
      },
    };
  }

  private async leadsByWeek(organizationId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: { organizationId },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const weeks: Record<string, number> = {};
    for (const c of contacts) {
      const week = c.createdAt.toISOString().slice(0, 10);
      weeks[week] = (weeks[week] ?? 0) + 1;
    }
    return Object.entries(weeks).map(([date, count]) => ({ date, count }));
  }

  private async conversationsByChannel(organizationId: string) {
    const channels = await this.prisma.channelConnection.groupBy({
      by: ['type'],
      where: { organizationId },
      _count: { id: true },
    });
    return channels.map((c) => ({ channel: c.type, count: c._count.id }));
  }
}
