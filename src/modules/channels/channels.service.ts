import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChannelStatus, MemberRole } from '@prisma/client';
import { TokenEncryptionService } from '../../common/crypto/token-encryption.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  DiscoveredWhatsAppChannel,
  EmbeddedSignupConnectConfig,
  PublicChannel,
  WHATSAPP_PROVIDER,
  WhatsAppOAuthResult,
} from './channels.constants';
import { WhatsAppEmbeddedSignupCompleteDto } from './dto/whatsapp-embedded-signup-complete.dto';
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

  async getEmbeddedSignupConfig(
    userId: string,
    workspaceId: string | undefined,
  ): Promise<EmbeddedSignupConnectConfig> {
    if (!workspaceId) {
      throw new BadRequestException('No workspace context found for this user');
    }

    await this.assertWorkspaceOwner(userId, workspaceId);

    const state = this.oauthState.create(workspaceId, userId);
    const appId = this.config.get<string>('META_APP_ID')?.trim() ?? '';
    const configId = this.config.get<string>('META_EMBEDDED_SIGNUP_CONFIG_ID')?.trim() ?? '';

    this.logger.log('Starting WhatsApp Embedded Signup', {
      workspaceId,
      userId,
      backendAppIdConfigured: Boolean(appId),
      backendConfigIdConfigured: Boolean(configId),
    });

    // appId/configId may be supplied by the Next.js BFF from NEXT_PUBLIC_* env vars.
    return { appId, configId, state };
  }

  async completeEmbeddedSignup(
    dto: WhatsAppEmbeddedSignupCompleteDto,
  ): Promise<WhatsAppOAuthResult> {
    const { workspaceId } = this.oauthState.verify(dto.state);
    this.assertMetaApiConfigured();

    try {
      this.logger.log('Embedded Signup complete received, exchanging code', { workspaceId });

      const token = await this.graphApi.exchangeEmbeddedSignupCode(dto.code);
      const channelInfo = await this.graphApi.resolveEmbeddedSignupChannel(
        token.accessToken,
        dto.business_id,
        dto.waba_id,
        dto.phone_number_id,
      );

      await this.graphApi.registerPhoneNumberIfNeeded(
        dto.phone_number_id,
        token.accessToken,
      );

      return this.saveConnectedChannel(workspaceId, channelInfo, token.accessToken);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof UnauthorizedException
      ) {
        this.logger.error('Embedded Signup complete failed', {
          workspaceId,
          error: error.message,
        });
        throw error;
      }

      this.logger.error('Embedded Signup complete failed unexpectedly', {
        workspaceId,
        error: error instanceof Error ? error.message : error,
      });

      throw new InternalServerErrorException(
        'Failed to complete WhatsApp connection. Please try again.',
      );
    }
  }

  async handleOAuthCallback(
    code: string | undefined,
    state: string | undefined,
    oauthError?: string,
  ): Promise<WhatsAppOAuthResult | string> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://botflow.ink';
    const redirectBase = `${frontendUrl}/dashboard/channels`;

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

      return this.saveConnectedChannel(workspaceId, discovered, token.accessToken);
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

  private async saveConnectedChannel(
    workspaceId: string,
    discovered: DiscoveredWhatsAppChannel,
    accessToken: string,
  ): Promise<WhatsAppOAuthResult> {
    const existingGlobal = await this.prisma.channel.findUnique({
      where: { phoneNumberId: discovered.phoneNumberId },
    });

    if (existingGlobal && existingGlobal.workspaceId !== workspaceId) {
      throw new ConflictException(
        'This WhatsApp phone number is already connected to another workspace',
      );
    }

    const encryptedAccessToken = this.encryption.encrypt(accessToken);

    const channel = await this.prisma.channel.upsert({
      where: { phoneNumberId: discovered.phoneNumberId },
      create: {
        workspaceId,
        provider: WHATSAPP_PROVIDER,
        businessId: discovered.businessId,
        wabaId: discovered.wabaId,
        phoneNumberId: discovered.phoneNumberId,
        displayPhoneNumber: discovered.displayPhoneNumber,
        businessName: discovered.businessName,
        encryptedAccessToken,
        status: ChannelStatus.PENDING,
      },
      update: {
        businessId: discovered.businessId,
        wabaId: discovered.wabaId,
        displayPhoneNumber: discovered.displayPhoneNumber,
        businessName: discovered.businessName,
        encryptedAccessToken,
      },
    });

    try {
      await this.graphApi.subscribeWabaToAppWebhooks(discovered.wabaId, accessToken);
    } catch (webhookError) {
      await this.prisma.channel.update({
        where: { id: channel.id },
        data: { status: ChannelStatus.ERROR },
      });
      throw webhookError;
    }

    const connected = await this.prisma.channel.update({
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
  }

  async listChannels(workspaceId: string): Promise<PublicChannel[]> {
    const channels = await this.prisma.channel.findMany({
      where: {
        workspaceId,
        provider: WHATSAPP_PROVIDER,
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
    const snapshot = toPublicChannel(channel);
    await this.disconnectChannel(channel, true);
    return snapshot;
  }

  async refreshChannel(workspaceId: string, channelId: string): Promise<PublicChannel> {
    const channel = await this.findWorkspaceChannel(workspaceId, channelId);

    if (!channel.encryptedAccessToken || !channel.wabaId) {
      throw new BadRequestException('Channel is missing credentials and must be reconnected');
    }

    const accessToken = this.encryption.decrypt(channel.encryptedAccessToken);

    try {
      await this.graphApi.validateAccessToken(accessToken);
      await this.graphApi.subscribeWabaToAppWebhooks(channel.wabaId, accessToken);

      const updated = await this.prisma.channel.update({
        where: { id: channel.id },
        data: { status: ChannelStatus.CONNECTED },
      });

      this.logger.log('WhatsApp channel refreshed', {
        workspaceId,
        channelId,
      });

      return toPublicChannel(updated);
    } catch (error) {
      await this.prisma.channel.update({
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
    channel: { id: string; wabaId: string; encryptedAccessToken: string | null },
    deleteRecord = false,
  ): Promise<void> {
    if (channel.encryptedAccessToken) {
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
      await this.prisma.channel.delete({ where: { id: channel.id } });
      this.logger.log('WhatsApp channel deleted', { channelId: channel.id });
      return;
    }

    await this.prisma.channel.update({
      where: { id: channel.id },
      data: {
        status: ChannelStatus.DISCONNECTED,
        encryptedAccessToken: null,
      },
    });

    this.logger.log('WhatsApp channel disconnected', { channelId: channel.id });
  }

  async disconnectChannelById(workspaceId: string, channelId: string): Promise<PublicChannel> {
    const channel = await this.findWorkspaceChannel(workspaceId, channelId);
    await this.disconnectChannel(channel, false);
    const updated = await this.prisma.channel.findUniqueOrThrow({
      where: { id: channelId },
    });
    return toPublicChannel(updated);
  }

  private async findWorkspaceChannel(workspaceId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: {
        id: channelId,
        workspaceId,
        provider: WHATSAPP_PROVIDER,
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return channel;
  }

  private assertMetaApiConfigured(): void {
    const missing: string[] = [];

    if (!this.config.get<string>('META_APP_ID')?.trim()) {
      missing.push('META_APP_ID');
    }
    if (!this.config.get<string>('META_APP_SECRET')?.trim()) {
      missing.push('META_APP_SECRET');
    }

    if (missing.length > 0) {
      throw new ServiceUnavailableException(
        `WhatsApp API is not configured. Add ${missing.join(' and ')} to the backend Environment in EasyPanel.`,
      );
    }
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
