import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelStatus, ChannelType, MemberRole } from '@prisma/client';
import { TokenEncryptionService } from '../../common/crypto/token-encryption.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PublicChannel, WhatsAppOAuthResult } from './channels.constants';
import { toPublicChannel } from './channels.mapper';
import { WhatsAppGraphApiService } from './whatsapp-graph-api.service';
import { WhatsAppOAuthStateService } from './whatsapp-oauth-state.service';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly encryption: TokenEncryptionService,
    private readonly graphApi: WhatsAppGraphApiService,
    private readonly oauthState: WhatsAppOAuthStateService,
  ) {}

  async getConnectUrl(userId: string, workspaceId: string | undefined): Promise<string> {
    if (!workspaceId) {
      throw new BadRequestException('No workspace context found for this user');
    }

    await this.assertWorkspaceOwner(userId, workspaceId);

    const state = this.oauthState.create(workspaceId, userId);
    this.logger.log('Starting WhatsApp Embedded Signup OAuth', { workspaceId, userId });

    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('META_APP_ID'),
      redirect_uri: this.graphApi.getRedirectUri(),
      state,
      response_type: 'code',
      scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
    });

    return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
  }

  async handleOAuthCallback(
    code: string | undefined,
    state: string | undefined,
    oauthError?: string,
  ): Promise<WhatsAppOAuthResult | string> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://botflow.ink';
    const redirectBase = `${frontendUrl}/settings/channels`;

    if (oauthError) {
      this.logger.warn('Meta OAuth denied by user', { error: oauthError });
      return `${redirectBase}?success=false&error=${encodeURIComponent(oauthError)}`;
    }

    if (!code || !state) {
      throw new BadRequestException('Missing authorization code or state');
    }

    const { workspaceId } = this.oauthState.verify(state);

    try {
      this.logger.log('OAuth callback received, exchanging code', { workspaceId });

      const token = await this.graphApi.exchangeAuthorizationCode(code);
      const discovered = await this.graphApi.discoverWhatsAppChannel(token.accessToken);

      const existingGlobal = await this.prisma.channelConnection.findUnique({
        where: { phoneNumberId: discovered.phoneNumberId },
      });

      if (existingGlobal && existingGlobal.organizationId !== workspaceId) {
        throw new ConflictException(
          'This WhatsApp phone number is already connected to another workspace',
        );
      }

      const tokenExpiresAt = token.expiresIn
        ? new Date(Date.now() + token.expiresIn * 1000)
        : null;

      const encryptedAccessToken = this.encryption.encrypt(token.accessToken);
      const now = new Date();

      const channel = await this.prisma.$transaction(async (tx) => {
        return tx.channelConnection.upsert({
          where: {
            organizationId_phoneNumberId: {
              organizationId: workspaceId,
              phoneNumberId: discovered.phoneNumberId,
            },
          },
          create: {
            organizationId: workspaceId,
            type: ChannelType.WHATSAPP,
            provider: 'whatsapp',
            name: discovered.displayPhoneNumber || discovered.businessName,
            status: ChannelStatus.PENDING,
            businessId: discovered.businessId,
            wabaId: discovered.wabaId,
            phoneNumberId: discovered.phoneNumberId,
            displayPhoneNumber: discovered.displayPhoneNumber,
            businessName: discovered.businessName,
            externalId: discovered.phoneNumberId,
            encryptedAccessToken,
            tokenExpiresAt,
            connectedAt: now,
            metadata: {
              verifiedName: discovered.verifiedName,
            },
          },
          update: {
            businessId: discovered.businessId,
            wabaId: discovered.wabaId,
            displayPhoneNumber: discovered.displayPhoneNumber,
            businessName: discovered.businessName,
            name: discovered.displayPhoneNumber || discovered.businessName,
            encryptedAccessToken,
            tokenExpiresAt,
            connectedAt: now,
            accessToken: null,
            metadata: {
              verifiedName: discovered.verifiedName,
            },
          },
        });
      });

      try {
        await this.graphApi.subscribeWabaToAppWebhooks(
          discovered.wabaId,
          token.accessToken,
        );
      } catch (webhookError) {
        await this.prisma.channelConnection.update({
          where: { id: channel.id },
          data: { status: ChannelStatus.ERROR },
        });
        throw webhookError;
      }

      const connected = await this.prisma.channelConnection.update({
        where: { id: channel.id },
        data: { status: ChannelStatus.CONNECTED },
      });

      this.logger.log('WhatsApp channel connected successfully', {
        workspaceId,
        channelId: connected.id,
        phoneNumberId: discovered.phoneNumberId,
        wabaId: discovered.wabaId,
        businessId: discovered.businessId,
      });

      return {
        connected: true,
        channelId: connected.id,
        workspaceId,
        phoneNumberId: discovered.phoneNumberId,
        wabaId: discovered.wabaId,
        businessId: discovered.businessId,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof UnauthorizedException
      ) {
        this.logger.error('OAuth callback failed', {
          workspaceId,
          error: error.message,
        });
        return `${redirectBase}?success=false&error=${encodeURIComponent(error.message)}`;
      }

      this.logger.error('OAuth callback failed unexpectedly', {
        workspaceId,
        error: error instanceof Error ? error.message : error,
      });

      throw new InternalServerErrorException(
        'Failed to complete WhatsApp connection. Please try again.',
      );
    }
  }

  async listChannels(workspaceId: string): Promise<PublicChannel[]> {
    const channels = await this.prisma.channelConnection.findMany({
      where: {
        organizationId: workspaceId,
        type: ChannelType.WHATSAPP,
      },
      orderBy: { createdAt: 'desc' },
    });

    return channels.map(toPublicChannel);
  }

  async getChannel(workspaceId: string, channelId: string): Promise<PublicChannel> {
    const channel = await this.findWorkspaceChannel(workspaceId, channelId);
    return toPublicChannel(channel);
  }

  async deleteChannel(workspaceId: string, channelId: string): Promise<PublicChannel> {
    const channel = await this.findWorkspaceChannel(workspaceId, channelId);
    await this.disconnectChannel(channel, true);
    const updated = await this.prisma.channelConnection.findUniqueOrThrow({
      where: { id: channelId },
    });
    return toPublicChannel(updated);
  }

  async refreshChannel(workspaceId: string, channelId: string): Promise<PublicChannel> {
    const channel = await this.findWorkspaceChannel(workspaceId, channelId);

    if (!channel.encryptedAccessToken || !channel.wabaId) {
      throw new BadRequestException('Channel is missing credentials and must be reconnected');
    }

    const accessToken = this.encryption.decrypt(channel.encryptedAccessToken);

    try {
      const { expiresAt } = await this.graphApi.validateAccessToken(accessToken);
      await this.graphApi.subscribeWabaToAppWebhooks(channel.wabaId, accessToken);

      const updated = await this.prisma.channelConnection.update({
        where: { id: channel.id },
        data: {
          status: ChannelStatus.CONNECTED,
          tokenExpiresAt: expiresAt ?? channel.tokenExpiresAt,
          connectedAt: new Date(),
        },
      });

      this.logger.log('WhatsApp channel refreshed', {
        workspaceId,
        channelId,
      });

      return toPublicChannel(updated);
    } catch (error) {
      await this.prisma.channelConnection.update({
        where: { id: channel.id },
        data: { status: ChannelStatus.ERROR },
      });

      this.logger.error('Channel refresh failed', {
        workspaceId,
        channelId,
        error: error instanceof Error ? error.message : error,
      });

      throw error;
    }
  }

  async disconnectChannel(
    channel: { id: string; wabaId: string | null; encryptedAccessToken: string | null },
    deleteRecord = false,
  ): Promise<void> {
    if (channel.wabaId && channel.encryptedAccessToken) {
      try {
        const accessToken = this.encryption.decrypt(channel.encryptedAccessToken);
        await this.graphApi.unsubscribeWabaFromAppWebhooks(channel.wabaId, accessToken);
      } catch (error) {
        this.logger.warn('Failed to unsubscribe WABA during disconnect', {
          channelId: channel.id,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    if (deleteRecord) {
      await this.prisma.channelConnection.delete({ where: { id: channel.id } });
      this.logger.log('WhatsApp channel deleted', { channelId: channel.id });
      return;
    }

    await this.prisma.channelConnection.update({
      where: { id: channel.id },
      data: {
        status: ChannelStatus.DISCONNECTED,
        encryptedAccessToken: null,
        accessToken: null,
        tokenExpiresAt: null,
      },
    });

    this.logger.log('WhatsApp channel disconnected', { channelId: channel.id });
  }

  async disconnectChannelById(workspaceId: string, channelId: string): Promise<PublicChannel> {
    const channel = await this.findWorkspaceChannel(workspaceId, channelId);
    await this.disconnectChannel(channel, false);
    const updated = await this.prisma.channelConnection.findUniqueOrThrow({
      where: { id: channelId },
    });
    return toPublicChannel(updated);
  }

  private async findWorkspaceChannel(workspaceId: string, channelId: string) {
    const channel = await this.prisma.channelConnection.findFirst({
      where: {
        id: channelId,
        organizationId: workspaceId,
        type: ChannelType.WHATSAPP,
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return channel;
  }

  private async assertWorkspaceOwner(userId: string, workspaceId: string): Promise<void> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: workspaceId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not belong to this workspace');
    }

    if (membership.role !== MemberRole.OWNER && membership.role !== MemberRole.ADMIN) {
      throw new ForbiddenException('Only workspace owners or admins can connect WhatsApp');
    }
  }
}
