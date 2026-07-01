import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  META_EMBEDDED_SIGNUP_SCOPES,
  META_GRAPH_API_VERSION,
  MetaCallbackResult,
} from './meta.constants';
import { MetaStateService } from './meta-state.service';

interface MetaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  error?: { message: string };
}

@Injectable()
export class MetaService {
  private readonly graphBase = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly metaState: MetaStateService,
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
    oauthError?: string,
  ): Promise<MetaCallbackResult> {
    if (oauthError) {
      throw new BadRequestException(oauthError);
    }

    if (!code || !state) {
      throw new BadRequestException('Missing authorization code or state');
    }

    const { workspaceId } = this.metaState.verify(state);
    const token = await this.exchangeAuthorizationCode(code);

    return {
      accessToken: token.access_token,
      expiresIn: token.expires_in ?? null,
      workspaceId,
    };
  }

  private buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('META_APP_ID'),
      redirect_uri: this.getRedirectUri(),
      state,
      response_type: 'code',
      scope: META_EMBEDDED_SIGNUP_SCOPES,
    });

    return `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
  }

  private getRedirectUri(): string {
    return this.config.getOrThrow<string>('META_REDIRECT_URI');
  }

  private async exchangeAuthorizationCode(code: string): Promise<MetaTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('META_APP_ID'),
      client_secret: this.config.getOrThrow<string>('META_APP_SECRET'),
      redirect_uri: this.getRedirectUri(),
      code,
    });

    const response = await fetch(
      `${this.graphBase}/oauth/access_token?${params.toString()}`,
    );

    const data = (await response.json()) as MetaTokenResponse;

    if (!response.ok || !data.access_token) {
      throw new BadRequestException(
        data.error?.message ?? 'Failed to exchange authorization code for access token',
      );
    }

    return data;
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
