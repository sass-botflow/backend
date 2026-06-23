import { Injectable, NotFoundException } from '@nestjs/common';
import { BotStatus, WorkflowNodeType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class BotsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.bot.findMany({
      where: { organizationId },
      include: { _count: { select: { nodes: true, edges: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(organizationId: string, data: { name: string; description?: string }) {
    return this.prisma.bot.create({
      data: { ...data, organizationId },
    });
  }

  async get(organizationId: string, id: string) {
    const bot = await this.prisma.bot.findFirst({
      where: { id, organizationId },
      include: { nodes: true, edges: true },
    });
    if (!bot) throw new NotFoundException('Bot not found');
    return bot;
  }

  async update(
    organizationId: string,
    id: string,
    data: { name?: string; description?: string; status?: BotStatus },
  ) {
    await this.ensureBot(organizationId, id);
    return this.prisma.bot.update({ where: { id }, data });
  }

  async remove(organizationId: string, id: string) {
    await this.ensureBot(organizationId, id);
    await this.prisma.bot.delete({ where: { id } });
    return { deleted: true };
  }

  async addNode(
    organizationId: string,
    botId: string,
    data: { type: WorkflowNodeType; label: string; config?: object; position?: object },
  ) {
    await this.ensureBot(organizationId, botId);
    return this.prisma.workflowNode.create({
      data: {
        type: data.type,
        label: data.label,
        config: data.config ?? {},
        position: data.position ?? { x: 0, y: 0 },
        botId,
      },
    });
  }

  async addEdge(
    organizationId: string,
    botId: string,
    data: { sourceId: string; targetId: string; condition?: string },
  ) {
    await this.ensureBot(organizationId, botId);
    return this.prisma.workflowEdge.create({
      data: { ...data, botId },
    });
  }

  private async ensureBot(organizationId: string, id: string) {
    const bot = await this.prisma.bot.findFirst({ where: { id, organizationId } });
    if (!bot) throw new NotFoundException('Bot not found');
    return bot;
  }
}
