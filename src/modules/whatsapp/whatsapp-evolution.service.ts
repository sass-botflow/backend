import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { WhatsappSession, WhatsappSessionStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EvolutionApiException } from './evolution-api.exception';
import { EvolutionApiService } from './evolution-api.service';
import { SendWhatsAppMessageDto } from './dto/send-whatsapp-message.dto';
import {
  extractQrBase64,
  normalizeEvolutionConnectionState,
  toPublicSession,
} from './whatsapp-evolution.mapper';
import {
  ConnectWhatsAppResult,
  ConnectedSessionResult,
  DeleteSessionResult,
  QrCodeResult,
  SendMessageResult,
  SessionStatusResult,
} from './whatsapp-evolution.types';

@Injectable()
export class WhatsAppEvolutionService {
  private readonly logger = new Logger(WhatsAppEvolutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly evolution: EvolutionApiService,
  ) {}

  async connect(userId: string): Promise<ConnectWhatsAppResult> {
    this.logger.log('WhatsApp connect requested', { userId });

    const existing = await this.prisma.whatsappSession.findUnique({
      where: { userId },
    });

    if (existing) {
      this.logger.log('Returning existing WhatsApp instance for user', {
        userId,
        instanceId: existing.id,
      });
      return {
        instanceId: existing.id,
        status: 'waiting_qr',
      };
    }

    const instanceName = await this.generateUniqueInstanceName(userId);
    let evolutionCreated = false;

    try {
      await this.evolution.createInstance(instanceName);
      evolutionCreated = true;

      const session = await this.prisma.whatsappSession.create({
        data: {
          userId,
          instanceName,
          status: WhatsappSessionStatus.WAITING_QR,
        },
      });

      try {
        await this.evolution.setWebhook(instanceName);
      } catch (webhookError) {
        this.logger.warn('Failed to set Evolution webhook after create', {
          instanceName,
          error: webhookError instanceof Error ? webhookError.message : webhookError,
        });
      }

      this.logger.log('WhatsApp session stored', {
        userId,
        instanceId: session.id,
        instanceName,
      });

      return {
        instanceId: session.id,
        status: 'waiting_qr',
      };
    } catch (error) {
      if (evolutionCreated) {
        await this.safeDeleteEvolutionInstance(instanceName);
      }
      throw this.normalizeError(error);
    }
  }

  async getQrCode(userId: string, instanceId: string): Promise<QrCodeResult> {
    const session = await this.getOwnedSession(userId, instanceId);

    if (session.status === WhatsappSessionStatus.CONNECTED) {
      return {
        instanceId: session.id,
        qrCode: '',
        status: 'CONNECTED',
      };
    }

    try {
      const qr = await this.evolution.connectInstance(session.instanceName);
      const qrCode = extractQrBase64(qr);

      if (!qrCode) {
        throw new EvolutionApiException(
          'QR_EXPIRED',
          'QR code is not available. Request a new connection.',
          410,
          qr,
        );
      }

      await this.prisma.whatsappSession.update({
        where: { id: session.id },
        data: {
          qrCode,
          status: WhatsappSessionStatus.WAITING_QR,
        },
      });

      return {
        instanceId: session.id,
        qrCode,
        status: 'WAITING_QR',
      };
    } catch (error) {
      throw this.normalizeError(error, 'QR_EXPIRED');
    }
  }

  async getStatus(userId: string, instanceId: string): Promise<SessionStatusResult> {
    const session = await this.getOwnedSession(userId, instanceId);

    try {
      const state = await this.evolution.getConnectionState(session.instanceName);
      const mapped = normalizeEvolutionConnectionState(
        state.instance?.state ?? state.state,
      );

      const updated =
        mapped !== session.status
          ? await this.prisma.whatsappSession.update({
              where: { id: session.id },
              data: { status: mapped },
            })
          : session;

      return {
        instanceId: updated.id,
        status: updated.status,
        phone: updated.phone,
        profileName: updated.profileName,
        connectedAt: updated.connectedAt?.toISOString() ?? null,
      };
    } catch (error) {
      if (error instanceof EvolutionApiException && error.code === 'INSTANCE_NOT_FOUND') {
        throw new EvolutionApiException(
          'SESSION_DELETED',
          'WhatsApp session was deleted from Evolution API',
          404,
        );
      }
      throw this.normalizeError(error);
    }
  }

  async deleteSession(userId: string, instanceId: string): Promise<DeleteSessionResult> {
    const session = await this.getOwnedSession(userId, instanceId);

    await this.safeDeleteEvolutionInstance(session.instanceName);

    await this.prisma.whatsappSession.delete({ where: { id: session.id } });

    this.logger.log('WhatsApp session deleted', {
      userId,
      instanceId: session.id,
      instanceName: session.instanceName,
    });

    return { deleted: true, instanceId: session.id };
  }

  async sendMessageForUser(
    userId: string,
    dto: SendWhatsAppMessageDto,
  ): Promise<SendMessageResult> {
    const session = await this.prisma.whatsappSession.findUnique({
      where: { userId },
    });

    if (!session) {
      throw new NotFoundException('WhatsApp session not found. Call POST /connect first.');
    }

    return this.sendMessage(userId, session.id, dto);
  }

  async sendMessage(
    userId: string,
    instanceId: string,
    dto: SendWhatsAppMessageDto,
  ): Promise<SendMessageResult> {
    const session = await this.getOwnedSession(userId, instanceId);

    if (session.status !== WhatsappSessionStatus.CONNECTED) {
      throw new EvolutionApiException(
        'CONNECTION_LOST',
        'WhatsApp is not connected. Scan the QR code to reconnect.',
        409,
      );
    }

    const number = dto.to.replace(/\D/g, '');

    try {
      const result = await this.evolution.sendTextMessage(session.instanceName, {
        number,
        text: dto.text,
      });

      return {
        success: true,
        messageId: result.key?.id ?? `evolution-${Date.now()}`,
        instanceId: session.id,
        to: number,
      };
    } catch (error) {
      throw this.normalizeError(error, 'CONNECTION_LOST');
    }
  }

  async handleConnectedUpdate(
    instanceName: string,
    data: Record<string, unknown>,
  ): Promise<ConnectedSessionResult | null> {
    const session = await this.prisma.whatsappSession.findUnique({
      where: { instanceName },
    });

    if (!session) {
      this.logger.warn('Evolution connection update for unknown instance', { instanceName });
      return null;
    }

    const state = String(data.state ?? data.status ?? '').toLowerCase();
    const isConnected = state === 'open';

    if (!isConnected) {
      await this.prisma.whatsappSession.update({
        where: { id: session.id },
        data: {
          status: WhatsappSessionStatus.DISCONNECTED,
          qrCode: null,
        },
      });

      this.logger.log('WhatsApp disconnected', { instanceName, state });
      return null;
    }

    const phone = this.extractPhone(data);
    const profileName = this.extractProfileName(data);

    const updated = await this.prisma.whatsappSession.update({
      where: { id: session.id },
      data: {
        status: WhatsappSessionStatus.CONNECTED,
        phone: phone ?? session.phone,
        profileName: profileName ?? session.profileName,
        connectedAt: session.connectedAt ?? new Date(),
        qrCode: null,
      },
    });

    try {
      await this.evolution.setWebhook(instanceName);
    } catch (error) {
      this.logger.warn('Webhook subscribe after connect failed', {
        instanceName,
        error: error instanceof Error ? error.message : error,
      });
    }

    this.logger.log('Channel saved after connection', {
      instanceId: updated.id,
      phone: updated.phone,
      profileName: updated.profileName,
    });

    return {
      connected: true,
      phone: updated.phone,
      profileName: updated.profileName,
      status: 'CONNECTED',
      instanceId: updated.id,
    };
  }

  async handleQrUpdate(instanceName: string, data: Record<string, unknown>): Promise<void> {
    const session = await this.prisma.whatsappSession.findUnique({
      where: { instanceName },
    });

    if (!session) {
      return;
    }

    const qrCode = extractQrBase64({
      base64: typeof data.qrcode === 'string' ? data.qrcode : undefined,
      code: typeof data.code === 'string' ? data.code : undefined,
    });

    if (!qrCode) {
      return;
    }

    await this.prisma.whatsappSession.update({
      where: { id: session.id },
      data: {
        qrCode,
        status: WhatsappSessionStatus.WAITING_QR,
      },
    });

    this.logger.log('QR code updated from Evolution webhook', { instanceName });
  }

  async findSessionByInstanceName(instanceName: string): Promise<WhatsappSession | null> {
    return this.prisma.whatsappSession.findUnique({ where: { instanceName } });
  }

  getPublicSession(userId: string, instanceId: string) {
    return this.getOwnedSession(userId, instanceId).then(toPublicSession);
  }

  private async getOwnedSession(userId: string, instanceId: string): Promise<WhatsappSession> {
    const session = await this.prisma.whatsappSession.findUnique({
      where: { id: instanceId },
    });

    if (!session) {
      throw new NotFoundException('WhatsApp session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenException('You do not have access to this WhatsApp session');
    }

    return session;
  }

  private async generateUniqueInstanceName(userId: string): Promise<string> {
    const userShort = userId.replace(/-/g, '').slice(0, 8).toLowerCase();

    for (let attempt = 0; attempt < 8; attempt++) {
      const suffix = randomBytes(4).toString('hex');
      const instanceName = `botflow-${userShort}-${suffix}`;

      const existing = await this.prisma.whatsappSession.findUnique({
        where: { instanceName },
        select: { id: true },
      });

      if (!existing) {
        return instanceName;
      }
    }

    throw new EvolutionApiException(
      'EVOLUTION_REQUEST_FAILED',
      'Could not generate a unique Evolution instance name',
      500,
    );
  }

  private async safeDeleteEvolutionInstance(instanceName: string): Promise<void> {
    try {
      await this.evolution.deleteInstance(instanceName);
    } catch (error) {
      this.logger.warn('Failed to delete Evolution instance during cleanup', {
        instanceName,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  private extractPhone(data: Record<string, unknown>): string | null {
    const wuid = data.wuid ?? data.phoneNumber;
    if (typeof wuid === 'string') {
      return wuid.replace(/@.*/, '').replace(/\D/g, '') || null;
    }
    return null;
  }

  private extractProfileName(data: Record<string, unknown>): string | null {
    const profile =
      data.profileName ??
      data.pushName ??
      (typeof data.profile === 'object' && data.profile && 'name' in data.profile
        ? (data.profile as { name?: string }).name
        : undefined);

    return typeof profile === 'string' && profile.trim() ? profile.trim() : null;
  }

  private normalizeError(error: unknown, fallbackCode?: EvolutionApiException['code']) {
    if (error instanceof EvolutionApiException) {
      return error;
    }

    if (error instanceof NotFoundException || error instanceof ForbiddenException) {
      return error;
    }

    return new EvolutionApiException(
      fallbackCode ?? 'EVOLUTION_REQUEST_FAILED',
      error instanceof Error ? error.message : 'Evolution API request failed',
      502,
      error,
    );
  }
}
