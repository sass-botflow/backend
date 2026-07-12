import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { InstagramConnectionData } from './instagram.types';
import { MetaGraphError, MetaGraphService } from './meta-graph.service';

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

  getAuthorizeUrl(userId: string): string {
    const state = this.signOAuthState(userId);
    return this.metaGraph.buildOAuthUrl(state);
  }

  async handleCallback(code: string, state: string): Promise<{ userId: string; username: string }> {
    if (!code?.trim()) {
      throw new InstagramOAuthError('Authorization code is missing.', 'missing_code');
    }

    const userId = this.verifyOAuthState(state);
    const shortLived = await this.metaGraph.exchangeCodeForToken(code);
    const longLived = await this.metaGraph.exchangeForLongLivedToken(shortLived.access_token);
    const connectionData = await this.resolveInstagramAccount(longLived.access_token);
    const expiresAt = this.tokenExpiresAt(longLived.expires_in);

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
        expiresAt,
      },
      update: {
        instagramUserId: connectionData.instagramUserId,
        instagramBusinessId: connectionData.instagramBusinessId,
        username: connectionData.username,
        profilePictureUrl: connectionData.profilePictureUrl,
        accessToken: connectionData.accessToken,
        refreshToken: connectionData.refreshToken,
        expiresAt,
        connectedAt: new Date(),
      },
    });

    return { userId, username: connectionData.username };
  }

  mapError(error: unknown): InstagramOAuthError {
    if (error instanceof InstagramOAuthError) {
      return error;
    }

    if (error instanceof MetaGraphError) {
      return new InstagramOAuthError(error.message, 'meta_api_error', error.statusCode);
    }

    return new InstagramOAuthError(
      'An unexpected error occurred during Instagram connection.',
      'unknown_error',
      500,
    );
  }

  private signOAuthState(userId: string): string {
    return this.jwt.sign(
      { userId, purpose: OAUTH_STATE_PURPOSE },
      { secret: this.config.getOrThrow<string>('JWT_SECRET'), expiresIn: '15m' },
    );
  }

  private verifyOAuthState(state: string): string {
    try {
      const payload = this.jwt.verify<{ userId?: string; purpose?: string }>(state, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });

      if (payload.purpose !== OAUTH_STATE_PURPOSE || !payload.userId) {
        throw new InstagramOAuthError('Invalid OAuth state.', 'invalid_state');
      }

      return payload.userId;
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

  private async resolveInstagramAccount(
    userAccessToken: string,
  ): Promise<InstagramConnectionData> {
    const pages = await this.metaGraph.fetchUserPages(userAccessToken);
    const pageWithInstagram = pages.data?.find(
      (page) => page.instagram_business_account?.id,
    );

    if (!pageWithInstagram?.instagram_business_account?.id) {
      throw new InstagramOAuthError(
        'No Instagram Business account linked to your Facebook Pages. Connect an Instagram Business account in Meta Business Suite first.',
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
      expiresAt: null,
    };
  }
}
