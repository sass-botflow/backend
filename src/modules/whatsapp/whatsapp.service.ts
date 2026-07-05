import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, WhatsAppSession, WhatsAppSessionStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { logServiceError } from '../../common/diagnostics/log-error.util';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateWhatsAppSessionDto } from './dto/create-whatsapp-session.dto';
import { WhatsAppSessionQrResponseDto } from './dto/whatsapp-session-qr-response.dto';
import { WhatsAppSessionStatusResponseDto } from './dto/whatsapp-session-status-response.dto';
import {
  toWhatsAppSessionEntity,
  WhatsAppSessionEntity,
} from './entities/whatsapp-session.entity';
import { EvolutionProvider } from './providers/evolution.provider';
import { EvolutionConnectionStateResult } from './providers/evolution.types';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private static readonly QR_EXPIRES_IN_SECONDS = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionProvider,
  ) {}

  async createSession(
    userId: string,
    workspaceId: string | undefined,
    dto: CreateWhatsAppSessionDto,
  ): Promise<WhatsAppSessionEntity> {
    const logContext = {
      userId,
      workspaceId: workspaceId ?? null,
      displayName: dto.displayName ?? null,
    };

    this.logger.log('[createSession] start', logContext);

    let resolvedWorkspaceId: string;

    this.logger.log('[createSession] before workspace lookup', logContext);
    try {
      resolvedWorkspaceId = this.requireWorkspaceId(workspaceId);
      this.logger.log('[createSession] after workspace lookup', {
        ...logContext,
        workspaceId: resolvedWorkspaceId,
      });
    } catch (error) {
      this.throwStepError('workspace lookup', error);
    }

    this.logger.log('[createSession] before admin validation', {
      ...logContext,
      workspaceId: resolvedWorkspaceId,
    });
    try {
      await this.assertWorkspaceAdmin(userId, resolvedWorkspaceId);
      this.logger.log('[createSession] after admin validation', {
        ...logContext,
        workspaceId: resolvedWorkspaceId,
      });
    } catch (error) {
      this.throwStepError('admin validation', error);
    }

    const instanceName = await this.generateUniqueInstanceName(resolvedWorkspaceId);
    const displayName = dto.displayName?.trim() || instanceName;

    this.logger.log('[createSession] before evolution createInstance', {
      ...logContext,
      workspaceId: resolvedWorkspaceId,
      instanceName,
      evolutionConfigured: this.evolution.isConfigured(),
    });
    try {
      await this.evolution.createInstance(instanceName);
      this.logger.log('[createSession] after evolution createInstance', {
        ...logContext,
        workspaceId: resolvedWorkspaceId,
        instanceName,
      });
    } catch (error) {
      this.throwStepError('evolution createInstance', error);
    }

    let session: WhatsAppSession;

    this.logger.log('[createSession] before prisma create', {
      ...logContext,
      workspaceId: resolvedWorkspaceId,
      instanceName,
      displayName,
    });
    try {
      session = await this.prisma.whatsAppSession.create({
        data: {
          workspaceId: resolvedWorkspaceId,
          instanceName,
          displayName,
          engine: 'evolution',
        },
      });
      this.logger.log('[createSession] after prisma create', {
        ...logContext,
        workspaceId: resolvedWorkspaceId,
        sessionId: session.id,
        instanceName,
      });
    } catch (error) {
      this.throwStepError('prisma create', error);
    }

    const response = toWhatsAppSessionEntity(session);

    this.logger.log('[createSession] response', {
      ...logContext,
      workspaceId: resolvedWorkspaceId,
      sessionId: session.id,
      instanceName,
      evolutionMocked: !this.evolution.isConfigured(),
    });

    return response;
  }

  private throwStepError(step: string, error: unknown): never {
    const diagnostic = this.buildStepDiagnostic(step, error);

    this.logger.error('[createSession] step failed', diagnostic);
    console.error('[ERROR] [createSession] step failed', diagnostic);

    if (error instanceof HttpException) {
      throw new HttpException(diagnostic, error.getStatus());
    }

    throw new InternalServerErrorException(diagnostic);
  }

  private buildStepDiagnostic(step: string, error: unknown): {
    step: string;
    error: string;
    stack: string;
  } {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      const errorMessage =
        typeof response === 'string'
          ? response
          : typeof response === 'object' && response !== null && 'message' in response
            ? String((response as { message?: unknown }).message)
            : error.message;

      return {
        step,
        error: errorMessage,
        stack: error.stack ?? '',
      };
    }

    if (error instanceof Error) {
      logServiceError(this.logger, `createSession:${step}`, error);
      return {
        step,
        error: error.message,
        stack: error.stack ?? '',
      };
    }

    logServiceError(this.logger, `createSession:${step}`, error);
    return {
      step,
      error: String(error),
      stack: '',
    };
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

    const session = await this.findWorkspaceSession(resolvedWorkspaceId, sessionId);
    return toWhatsAppSessionEntity(session);
  }

  async getSessionQr(
    userId: string,
    workspaceId: string | undefined,
    sessionId: string,
  ): Promise<WhatsAppSessionQrResponseDto> {
    const resolvedWorkspaceId = this.requireWorkspaceId(workspaceId);
    await this.assertWorkspaceMember(userId, resolvedWorkspaceId);

    const session = await this.findWorkspaceSession(resolvedWorkspaceId, sessionId);

    if (session.status === WhatsAppSessionStatus.CONNECTED) {
      throw new BadRequestException('WhatsApp session is already connected');
    }

    const { base64 } = await this.evolution.connectInstance(session.instanceName);

    if (session.status !== WhatsAppSessionStatus.CONNECTING) {
      await this.prisma.whatsAppSession.update({
        where: { id: session.id },
        data: { status: WhatsAppSessionStatus.CONNECTING },
      });
    }

    this.logger.log('WhatsApp session QR issued', {
      workspaceId: resolvedWorkspaceId,
      sessionId: session.id,
      instanceName: session.instanceName,
    });

    return {
      base64,
      status: WhatsAppSessionStatus.CONNECTING,
      expiresIn: WhatsAppService.QR_EXPIRES_IN_SECONDS,
    };
  }

  async getSessionStatus(
    userId: string,
    workspaceId: string | undefined,
    sessionId: string,
  ): Promise<WhatsAppSessionStatusResponseDto> {
    const resolvedWorkspaceId = this.requireWorkspaceId(workspaceId);
    await this.assertWorkspaceMember(userId, resolvedWorkspaceId);

    const session = await this.findWorkspaceSession(resolvedWorkspaceId, sessionId);
    const connectionState = await this.evolution.getConnectionState(session.instanceName);
    const mappedStatus = this.mapEvolutionStateToSessionStatus(
      connectionState.state,
      session.status,
    );

    const updatedSession = await this.syncSessionFromConnectionState(
      session,
      connectionState,
      mappedStatus,
    );

    return {
      status: updatedSession.status,
      phoneNumber: updatedSession.phoneNumber,
      displayName: updatedSession.displayName,
    };
  }

  private mapEvolutionStateToSessionStatus(
    evolutionState: string,
    currentStatus: WhatsAppSessionStatus,
  ): WhatsAppSessionStatus {
    const normalized = evolutionState.toLowerCase();

    if (normalized === 'open') {
      return WhatsAppSessionStatus.CONNECTED;
    }

    if (normalized === 'connecting') {
      return WhatsAppSessionStatus.CONNECTING;
    }

    if (normalized === 'close' || normalized === 'closed') {
      if (
        currentStatus === WhatsAppSessionStatus.CONNECTING ||
        currentStatus === WhatsAppSessionStatus.CONNECTED
      ) {
        return WhatsAppSessionStatus.DISCONNECTED;
      }

      return WhatsAppSessionStatus.CREATED;
    }

    return currentStatus;
  }

  private async syncSessionFromConnectionState(
    session: WhatsAppSession,
    connectionState: EvolutionConnectionStateResult,
    mappedStatus: WhatsAppSessionStatus,
  ): Promise<WhatsAppSession> {
    const updateData: {
      status: WhatsAppSessionStatus;
      phoneNumber?: string | null;
      displayName?: string;
    } = { status: mappedStatus };

    if (mappedStatus === WhatsAppSessionStatus.CONNECTED) {
      if (connectionState.phoneNumber) {
        updateData.phoneNumber = connectionState.phoneNumber;
      }

      if (connectionState.profileName) {
        updateData.displayName = connectionState.profileName;
      }
    }

    const hasChanges =
      session.status !== updateData.status ||
      (updateData.phoneNumber !== undefined && session.phoneNumber !== updateData.phoneNumber) ||
      (updateData.displayName !== undefined && session.displayName !== updateData.displayName);

    if (!hasChanges) {
      return session;
    }

    const updated = await this.prisma.whatsAppSession.update({
      where: { id: session.id },
      data: updateData,
    });

    this.logger.log('WhatsApp session status synced from Evolution', {
      sessionId: session.id,
      instanceName: session.instanceName,
      status: updated.status,
      phoneNumber: updated.phoneNumber,
    });

    return updated;
  }

  private async findWorkspaceSession(
    workspaceId: string,
    sessionId: string,
  ): Promise<WhatsAppSession> {
    const session = await this.prisma.whatsAppSession.findFirst({
      where: {
        id: sessionId,
        workspaceId,
      },
    });

    if (!session) {
      throw new NotFoundException('WhatsApp session not found');
    }

    return session;
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
