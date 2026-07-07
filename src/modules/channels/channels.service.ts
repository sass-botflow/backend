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
  EmbeddedSignupDiscoveryContext,
  EmbeddedSignupScenario,
  PublicChannel,
  WHATSAPP_PROVIDER,
  WhatsAppOAuthResult,
} from './channels.constants';
import { WhatsAppEmbeddedSignupCompleteDto } from './dto/whatsapp-embedded-signup-complete.dto';
import { toPublicChannel } from './channels.mapper';
import {
  EmbeddedSignupProgressTracker,
  isEmbeddedSignupProgressResponse,
} from './embedded-signup-progress';
import {
  DiscoveredWhatsAppChannelWithScenario,
  MetaGraphApiException,
  WhatsAppGraphApiService,
} from './whatsapp-graph-api.service';
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

    return { appId, configId, state };
  }

  async completeEmbeddedSignup(
    dto: WhatsAppEmbeddedSignupCompleteDto,
  ): Promise<WhatsAppOAuthResult> {
    const { workspaceId } = this.oauthState.verify(dto.state);
    this.assertMetaApiConfigured();

    const progress = new EmbeddedSignupProgressTracker();

    try {
      this.logger.log('Embedded Signup complete received, exchanging code', { workspaceId });

      const token = await this.graphApi.exchangeEmbeddedSignupCode(dto.code);
      progress.complete('exchange_code', 'Authorization code exchanged for access token');

      const channelInfo = await this.discoverChannelWithProgress(progress, token.accessToken);
      this.assertDiscoveredChannel(channelInfo, progress);

      await this.subscribeWebhooksWithProgress(
        progress,
        channelInfo.wabaId,
        token.accessToken,
      );

      return this.saveConnectedChannel(
        workspaceId,
        channelInfo,
        token.accessToken,
        progress,
      );
    } catch (error) {
      return this.handleEmbeddedSignupError(error, workspaceId, progress);
    }
  }

  private async discoverChannelWithProgress(
    progress: EmbeddedSignupProgressTracker,
    accessToken: string,
  ): Promise<DiscoveredWhatsAppChannelWithScenario> {
    try {
      const { context, debugData } = await this.graphApi.initEmbeddedSignupDiscovery(accessToken);

      const business = await this.graphApi.discoverBusinessManager(
        accessToken,
        context,
        debugData,
      );
      progress.complete(
        'discover_business',
        `Business Manager discovered (${business.businessName})`,
      );

      const waba = await this.graphApi.discoverWabaAccount(
        accessToken,
        context,
        business.businessId,
      );
      progress.complete(
        'discover_waba',
        context.wabaId
          ? `WhatsApp Business Account linked (${waba.wabaId})`
          : `WhatsApp Business Account discovered via Embedded Signup (${waba.wabaId})`,
      );

      const phone = await this.graphApi.discoverPhoneNumber(
        accessToken,
        waba.wabaId,
        context,
      );
      progress.complete(
        'discover_phone',
        phone.displayPhoneNumber
          ? `Phone number discovered (${phone.displayPhoneNumber})`
          : `Phone number discovered (${phone.phoneNumberId})`,
      );

      const scenario = this.inferScenarioFromContext(context);

      return {
        businessId: waba.businessId,
        wabaId: waba.wabaId,
        phoneNumberId: phone.phoneNumberId,
        displayPhoneNumber: phone.displayPhoneNumber,
        verifiedName: phone.verifiedName,
        businessName: waba.businessName,
        scenario,
      };
    } catch (error) {
      if (error instanceof MetaGraphApiException) {
        const step = this.mapDiscoveryFailureToStep(error.operation);
        progress.fail(step, error.getPublicMessage());
      }
      throw error;
    }
  }

  private inferScenarioFromContext(
    context: EmbeddedSignupDiscoveryContext,
  ): EmbeddedSignupScenario {
    if (context.phoneNumberId && context.wabaId) {
      return 'existing_phone';
    }

    if (context.wabaId) {
      return 'existing_waba';
    }

    if (context.businessId) {
      return 'existing_business';
    }

    return 'new_setup';
  }

  private async subscribeWebhooksWithProgress(
    progress: EmbeddedSignupProgressTracker,
    wabaId: string,
    accessToken: string,
  ): Promise<void> {
    try {
      await this.graphApi.subscribeWabaToAppWebhooks(wabaId, accessToken);
      progress.complete('subscribe_webhooks', 'WABA subscribed to application webhooks');
    } catch (error) {
      if (error instanceof MetaGraphApiException) {
        progress.fail('subscribe_webhooks', error.getPublicMessage());
      }
      throw error;
    }
  }

  private mapDiscoveryFailureToStep(
    operation: string,
  ): 'discover_business' | 'discover_waba' | 'discover_phone' {
    if (
      operation === 'listUserBusinesses' ||
      operation === 'debugToken' ||
      operation === 'discoverBusiness'
    ) {
      return 'discover_business';
    }

    if (
      operation === 'discoverWaba' ||
      operation === 'listOwnedWabas' ||
      operation === 'listClientWabas' ||
      operation === 'getWabaDetails'
    ) {
      return 'discover_waba';
    }

    if (
      operation === 'listPhoneNumbers' ||
      operation === 'getPhoneNumberDetails' ||
      operation === 'registerPhoneNumber'
    ) {
      return 'discover_phone';
    }

    return 'discover_phone';
  }

  private handleEmbeddedSignupError(
    error: unknown,
    workspaceId: string,
    progress: EmbeddedSignupProgressTracker,
  ): never {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      if (isEmbeddedSignupProgressResponse(response)) {
        this.logger.error('Embedded Signup complete failed', {
          workspaceId,
          step: response.step,
          steps: response.steps,
        });
        throw error;
      }
    }

    if (error instanceof MetaGraphApiException) {
      this.logger.error('Embedded Signup failed during Meta Graph API call', {
        workspaceId,
        operation: error.operation,
        httpStatus: error.httpStatus,
        metaResponse: error.metaResponse,
        steps: progress.snapshot(),
      });
      throw new BadRequestException({
        message: error.getPublicMessage(),
        step: this.mapDiscoveryFailureToStep(error.operation),
        steps: progress.snapshot(),
      });
    }

    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException ||
      error instanceof UnauthorizedException
    ) {
      this.logger.error('Embedded Signup complete failed', {
        workspaceId,
        error: error.message,
        steps: progress.snapshot(),
      });
      throw error;
    }

    this.logger.error('Embedded Signup complete failed unexpectedly', {
      workspaceId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      steps: progress.snapshot(),
    });

    throw new InternalServerErrorException(
      'Failed to complete WhatsApp connection. Please try again.',
    );
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
      this.assertDiscoveredChannel(discovered);

      const progress = new EmbeddedSignupProgressTracker();
      progress.complete('exchange_code');
      progress.complete('discover_business');
      progress.complete('discover_waba');
      progress.complete('discover_phone');

      await this.subscribeWebhooksWithProgress(
        progress,
        discovered.wabaId,
        token.accessToken,
      );

      return this.saveConnectedChannel(workspaceId, discovered, token.accessToken, progress);
    } catch (error) {
      if (error instanceof MetaGraphApiException) {
        this.logger.error('OAuth callback failed during Meta Graph API call', {
          workspaceId,
          operation: error.operation,
          httpStatus: error.httpStatus,
          metaResponse: error.metaResponse,
        });
        return `${redirectBase}?success=false&error=${encodeURIComponent(error.getPublicMessage())}`;
      }

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

  private assertDiscoveredChannel(
    channel: DiscoveredWhatsAppChannel,
    progress?: EmbeddedSignupProgressTracker,
  ): void {
    const missing: Array<{ field: string; step: 'discover_business' | 'discover_waba' | 'discover_phone' }> =
      [];

    if (!channel.businessId?.trim()) missing.push({ field: 'businessId', step: 'discover_business' });
    if (!channel.wabaId?.trim()) missing.push({ field: 'wabaId', step: 'discover_waba' });
    if (!channel.phoneNumberId?.trim()) missing.push({ field: 'phoneNumberId', step: 'discover_phone' });
    if (!channel.displayPhoneNumber?.trim()) {
      missing.push({ field: 'displayPhoneNumber', step: 'discover_phone' });
    }

    if (missing.length > 0) {
      const message = `WhatsApp channel discovery incomplete: missing ${missing.map((item) => item.field).join(', ')}`;
      if (progress) {
        progress.fail(missing[0].step, message);
      }
      throw new BadRequestException(message);
    }
  }

  private async saveConnectedChannel(
    workspaceId: string,
    discovered: DiscoveredWhatsAppChannel & { scenario?: EmbeddedSignupScenario },
    accessToken: string,
    progress?: EmbeddedSignupProgressTracker,
  ): Promise<WhatsAppOAuthResult> {
    const existingGlobal = await this.prisma.channel.findUnique({
      where: { phoneNumberId: discovered.phoneNumberId },
    });

    if (existingGlobal && existingGlobal.workspaceId !== workspaceId) {
      if (progress) {
        progress.fail(
          'save_credentials',
          'This WhatsApp phone number is already connected to another workspace',
        );
      }
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

    progress?.complete('save_credentials', 'Access token encrypted and channel saved');

    const connected = await this.prisma.channel.update({
      where: { id: channel.id },
      data: { status: ChannelStatus.CONNECTED },
    });

    progress?.complete('connected', 'WhatsApp channel connected');

    this.logger.log('WhatsApp channel connected successfully', {
      workspaceId,
      channelId: connected.id,
      phoneNumberId: discovered.phoneNumberId,
      wabaId: discovered.wabaId,
      businessId: discovered.businessId,
      displayPhoneNumber: discovered.displayPhoneNumber,
      scenario: discovered.scenario ?? 'new_setup',
    });

    return {
      connected: true,
      channelId: connected.id,
      workspaceId,
      phoneNumberId: discovered.phoneNumberId,
      wabaId: discovered.wabaId,
      businessId: discovered.businessId,
      scenario: discovered.scenario ?? 'new_setup',
      steps: progress?.snapshot() ?? [],
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
