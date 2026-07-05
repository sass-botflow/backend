import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateWhatsAppSessionDto } from './dto/create-whatsapp-session.dto';
import {
  toWhatsAppSessionEntity,
  WhatsAppSessionEntity,
} from './entities/whatsapp-session.entity';
import { EvolutionProvider } from './providers/evolution.provider';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionProvider,
  ) {}

  async createSession(
    userId: string,
    workspaceId: string | undefined,
    dto: CreateWhatsAppSessionDto,
  ): Promise<WhatsAppSessionEntity> {
    const resolvedWorkspaceId = this.requireWorkspaceId(workspaceId);
    await this.assertWorkspaceAdmin(userId, resolvedWorkspaceId);

    const instanceName = await this.generateUniqueInstanceName(resolvedWorkspaceId);
    const displayName = dto.displayName?.trim() || instanceName;

    await this.evolution.createInstance(instanceName);

    const session = await this.prisma.whatsAppSession.create({
      data: {
        workspaceId: resolvedWorkspaceId,
        instanceName,
        displayName,
        engine: 'evolution',
      },
    });

    this.logger.log('WhatsApp session created', {
      workspaceId: resolvedWorkspaceId,
      sessionId: session.id,
      instanceName,
      evolutionMocked: !this.evolution.isConfigured(),
    });

    return toWhatsAppSessionEntity(session);
  }

  async listSessions(
    userId: string,
    workspaceId: string | undefined,
  ): Promise<WhatsAppSessionEntity[]> {
    const resolvedWorkspaceId = this.requireWorkspaceId(workspaceId);
    await this.assertWorkspaceMember(userId, resolvedWorkspaceId);

    const sessions = await this.prisma.whatsAppSession.findMany({
      where: { workspaceId: resolvedWorkspaceId },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map(toWhatsAppSessionEntity);
  }

  async getSession(
    userId: string,
    workspaceId: string | undefined,
    sessionId: string,
  ): Promise<WhatsAppSessionEntity> {
    const resolvedWorkspaceId = this.requireWorkspaceId(workspaceId);
    await this.assertWorkspaceMember(userId, resolvedWorkspaceId);

    const session = await this.prisma.whatsAppSession.findFirst({
      where: {
        id: sessionId,
        workspaceId: resolvedWorkspaceId,
      },
    });

    if (!session) {
      throw new NotFoundException('WhatsApp session not found');
    }

    return toWhatsAppSessionEntity(session);
  }

  private requireWorkspaceId(workspaceId: string | undefined): string {
    if (!workspaceId) {
      throw new BadRequestException('No workspace context found for this user');
    }
    return workspaceId;
  }

  private async generateUniqueInstanceName(workspaceId: string): Promise<string> {
    const workspaceShort = workspaceId.replace(/-/g, '').slice(0, 8).toLowerCase();

    for (let attempt = 0; attempt < 5; attempt++) {
      const suffix = randomBytes(4).toString('hex');
      const instanceName = `botflow-${workspaceShort}-${suffix}`;

      const existing = await this.prisma.whatsAppSession.findUnique({
        where: { instanceName },
        select: { id: true },
      });

      if (!existing) {
        return instanceName;
      }
    }

    throw new BadRequestException('Could not generate a unique WhatsApp instance name');
  }

  private async assertWorkspaceAdmin(userId: string, workspaceId: string): Promise<void> {
    const membership = await this.assertWorkspaceMember(userId, workspaceId);

    if (membership.role !== MemberRole.OWNER && membership.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only workspace owners or admins can create WhatsApp sessions');
    }
  }

  private async assertWorkspaceMember(userId: string, workspaceId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: workspaceId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not belong to this workspace');
    }

    return membership;
  }
}
