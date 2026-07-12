import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { InstagramConnectionData, InstagramOAuthFlow } from './instagram.types';
import { MetaGraphError, MetaGraphService } from './meta-graph.service';
import { resolveOAuthFlow } from './meta.config';

const OAUTH_STATE_PURPOSE = 'instagram_oauth';

export class InstagramOAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'InstagramOAuthError';
  }
}

@Injectable()
export class InstagramAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly metaGraph: MetaGraphService,
  ) {}

  getAuthorizeUrl(userId: string, flowInput?: string): string {
    const flow = resolveOAuthFlow(flowInput, this.config);
    const state = this.signOAuthState(userId, flow);

    if (flow === 'facebook') {
      return this.metaGraph.buildFacebookOAuthUrl(state);
    }

    return this.metaGraph.buildInstagramLoginUrl(state);
  }

  async handleCallback(code: string, state: string): Promise<{ userId: string; username: string }> {
    if (!code?.trim()) {
      throw new InstagramOAuthError('Authorization code is missing.', 'missing_code');
    }

    const { userId, flow } = this.verifyOAuthState(state);
    const connectionData =
      flow === 'facebook'
        ? await this.resolveViaFacebookLogin(code)
        : await this.resolveViaInstagramLogin(code);

    await this.saveConnection(userId, connectionData);

    return { userId, username: connectionData.username };
  }

  mapError(error: unknown): InstagramOAuthError {
    if (error instanceof InstagramOAuthError) {
      return error;
    }

    if (error instanceof MetaGraphError) {
      const message = error.message.toLowerCase().includes('personal')
        ? 'Personal Instagram accounts cannot connect via API. Switch to Creator (free): Instagram app → Settings → Account type → Switch to professional account → Creator.'
        : error.message;

      return new InstagramOAuthError(message, 'meta_api_error', error.statusCode);
    }

    return new InstagramOAuthError(
      'An unexpected error occurred during Instagram connection.',
      'unknown_error',
      500,
    );
  }

  private async saveConnection(userId: string, connectionData: InstagramConnectionData): Promise<void> {
    await this.prisma.instagramConnection.upsert({
      where: { userId },
      create: {
        userId,
        instagramUserId: connectionData.instagramUserId,
        instagramBusinessId: connectionData.instagramBusinessId,
        username: connectionData.username,
        profilePictureUrl: connectionData.profilePictureUrl,
        accessToken: connectionData.accessToken,
        refreshToken: connectionData.refreshToken,
        expiresAt: connectionData.expiresAt,
      },
      update: {
        instagramUserId: connectionData.instagramUserId,
        instagramBusinessId: connectionData.instagramBusinessId,
        username: connectionData.username,
        profilePictureUrl: connectionData.profilePictureUrl,
        accessToken: connectionData.accessToken,
        refreshToken: connectionData.refreshToken,
        expiresAt: connectionData.expiresAt,
        connectedAt: new Date(),
      },
    });
  }

  private async resolveViaInstagramLogin(code: string): Promise<InstagramConnectionData> {
    const shortLived = await this.metaGraph.exchangeInstagramLoginCode(code);
    const longLived = await this.metaGraph.exchangeInstagramLongLivedToken(shortLived.accessToken);
    const profile = await this.metaGraph.fetchInstagramLoginProfile(longLived.access_token);

    const instagramUserId = profile.user_id ?? profile.id ?? shortLived.userId;
    const username = profile.username;

    if (!username) {
      throw new InstagramOAuthError(
        'Could not retrieve Instagram username. Make sure your account is a Professional account (Creator or Business).',
        'profile_fetch_failed',
      );
    }

    return {
      instagramUserId,
      instagramBusinessId: instagramUserId,
      username,
      profilePictureUrl: profile.profile_picture_url ?? null,
      accessToken: longLived.access_token,
      refreshToken: null,
      expiresAt: this.tokenExpiresAt(longLived.expires_in),
      accountType: profile.account_type ?? 'PROFESSIONAL',
    };
  }

  private async resolveViaFacebookLogin(code: string): Promise<InstagramConnectionData> {
    const shortLived = await this.metaGraph.exchangeFacebookCodeForToken(code);
    const longLived = await this.metaGraph.exchangeForLongLivedFacebookToken(shortLived.access_token);
    return this.resolveInstagramFromPages(longLived.access_token, longLived.expires_in);
  }

  private signOAuthState(userId: string, flow: InstagramOAuthFlow): string {
    return this.jwt.sign(
      { userId, purpose: OAUTH_STATE_PURPOSE, flow },
      { secret: this.config.getOrThrow<string>('JWT_SECRET'), expiresIn: '15m' },
    );
  }

  private verifyOAuthState(state: string): { userId: string; flow: InstagramOAuthFlow } {
    try {
      const payload = this.jwt.verify<{
        userId?: string;
        purpose?: string;
        flow?: InstagramOAuthFlow;
      }>(state, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });

      if (payload.purpose !== OAUTH_STATE_PURPOSE || !payload.userId) {
        throw new InstagramOAuthError('Invalid OAuth state.', 'invalid_state');
      }

      return {
        userId: payload.userId,
        flow: payload.flow === 'facebook' ? 'facebook' : 'instagram',
      };
    } catch (error) {
      if (error instanceof InstagramOAuthError) {
        throw error;
      }
      throw new InstagramOAuthError(
        'OAuth state is invalid or expired. Please try connecting again.',
        'invalid_state',
      );
    }
  }

  private tokenExpiresAt(expiresIn?: number): Date | null {
    if (!expiresIn || expiresIn <= 0) {
      return null;
    }
    return new Date(Date.now() + expiresIn * 1000);
  }

  private async resolveInstagramFromPages(
    userAccessToken: string,
    expiresIn?: number,
  ): Promise<InstagramConnectionData> {
    const pages = await this.metaGraph.fetchAllUserPages(userAccessToken);
    const pageWithInstagram = pages.find((page) => page.instagram_business_account?.id);

    if (!pageWithInstagram?.instagram_business_account?.id) {
      throw new InstagramOAuthError(
        'No Instagram Professional account found on your Facebook Pages. Try Instagram Login instead (no Facebook Page needed): use /api/auth/instagram?flow=instagram. Or switch your IG to Creator: Instagram → Settings → Account type → Professional.',
        'no_instagram_business_account',
      );
    }

    const instagramBusinessId = pageWithInstagram.instagram_business_account.id;
    const pageAccessToken = pageWithInstagram.access_token ?? userAccessToken;
    const profile = await this.metaGraph.fetchInstagramProfile(
      instagramBusinessId,
      pageAccessToken,
    );

    if (!profile.username) {
      throw new InstagramOAuthError(
        'Could not retrieve Instagram username from Meta.',
        'profile_fetch_failed',
      );
    }

    return {
      instagramUserId: profile.id,
      instagramBusinessId,
      username: profile.username,
      profilePictureUrl: profile.profile_picture_url ?? null,
      accessToken: pageAccessToken,
      refreshToken: null,
      expiresAt: this.tokenExpiresAt(expiresIn),
      accountType: 'BUSINESS',
    };
  }
}
