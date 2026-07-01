import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemberRole, WhatsAppAccountStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  META_EMBEDDED_SIGNUP_SCOPES,
  META_GRAPH_API_VERSION,
  MetaConnectionResult,
} from './meta.constants';
import { MetaGraphApiService } from './meta-graph-api.service';
import { MetaStateService } from './meta-state.service';

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly metaState: MetaStateService,
    private readonly metaGraphApi: MetaGraphApiService,
  ) {}

  async getConnectUrl(userId: string, workspaceId: string | undefined): Promise<string> {
    if (!workspaceId) {
      throw new BadRequestException('No workspace context found for this user');
    }

    await this.assertWorkspaceOwner(userId, workspaceId);

    const state = this.metaState.create(workspaceId);
    return this.buildAuthorizationUrl(state);
  }

  async handleCallback(
    code: string | undefined,
    state: string | undefined,
  ): Promise<MetaConnectionResult> {
    if (!code || !state) {
      throw new BadRequestException('Missing authorization code or state');
    }

    const { workspaceId } = this.metaState.verify(state);

    try {
      const token = await this.metaGraphApi.exchangeAuthorizationCode(code);
      const discovered = await this.metaGraphApi.discoverWhatsAppAccount(token.accessToken);

      const tokenExpiresAt = token.expiresIn
        ? new Date(Date.now() + token.expiresIn * 1000)
        : null;

      const account = await this.prisma.$transaction(async (tx) => {
        return tx.whatsAppAccount.upsert({
          where: {
            organizationId_phoneNumberId: {
              organizationId: workspaceId,
              phoneNumberId: discovered.phoneNumberId,
            },
          },
          create: {
            organizationId: workspaceId,
            wabaId: discovered.wabaId,
            phoneNumberId: discovered.phoneNumberId,
            displayPhoneNumber: discovered.displayPhoneNumber,
            verifiedName: discovered.verifiedName,
            businessName: discovered.businessName,
            accessToken: token.accessToken,
            tokenExpiresAt,
            status: WhatsAppAccountStatus.CONNECTED,
            connectedAt: new Date(),
          },
          update: {
            wabaId: discovered.wabaId,
            displayPhoneNumber: discovered.displayPhoneNumber,
            verifiedName: discovered.verifiedName,
            businessName: discovered.businessName,
            accessToken: token.accessToken,
            tokenExpiresAt,
            status: WhatsAppAccountStatus.CONNECTED,
            connectedAt: new Date(),
          },
        });
      });

      try {
        await this.metaGraphApi.subscribeWabaToAppWebhooks(
          discovered.wabaId,
          token.accessToken,
        );
      } catch (webhookError) {
        this.logger.error('Webhook subscription failed after account save', {
          workspaceId,
          wabaId: discovered.wabaId,
          error: webhookError instanceof Error ? webhookError.message : webhookError,
        });

        await this.prisma.whatsAppAccount.update({
          where: { id: account.id },
          data: { status: WhatsAppAccountStatus.ERROR },
        });

        throw webhookError;
      }

      return {
        connected: true,
        workspaceId,
        phoneNumberId: discovered.phoneNumberId,
        wabaId: discovered.wabaId,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error('Meta connection flow failed', {
        workspaceId,
        error: error instanceof Error ? error.message : error,
      });

      throw new InternalServerErrorException(
        'Failed to complete WhatsApp connection. Please try again.',
      );
    }
  }

  private buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('META_APP_ID'),
      redirect_uri: this.metaGraphApi.getRedirectUri(),
      state,
      response_type: 'code',
      scope: META_EMBEDDED_SIGNUP_SCOPES,
    });

    return `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
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

    if (membership.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Only workspace owners can connect WhatsApp');
    }
  }
}
