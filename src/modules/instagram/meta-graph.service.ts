import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getMetaConfig, type MetaConfig } from './meta.config';
import type {
  InstagramProfile,
  MetaOAuthErrorResponse,
  MetaPagesResponse,
  MetaTokenResponse,
} from './instagram.types';

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
  ) {
    super(message);
    this.name = 'MetaGraphError';
  }
}

@Injectable()
export class MetaGraphService {
  constructor(private readonly config: ConfigService) {}

  getConfigOrThrow(): MetaConfig {
    const meta = getMetaConfig(this.config);
    if (!meta) {
      throw new MetaGraphError(
        'Meta OAuth is not configured. Set META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.',
        503,
      );
    }
    return meta;
  }

  isConfigured(): boolean {
    return getMetaConfig(this.config) !== null;
  }

  buildOAuthUrl(state: string): string {
    const meta = this.getConfigOrThrow();
    const params = new URLSearchParams({
      client_id: meta.appId,
      redirect_uri: meta.redirectUri,
      scope: meta.scopes,
      response_type: 'code',
      state,
    });

    return `https://www.facebook.com/${meta.graphApiVersion}/dialog/oauth?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<MetaTokenResponse> {
    const meta = this.getConfigOrThrow();
    const params = new URLSearchParams({
      client_id: meta.appId,
      client_secret: meta.appSecret,
      redirect_uri: meta.redirectUri,
      code,
    });

    const response = await fetch(
      `${this.graphBase(meta)}/oauth/access_token?${params.toString()}`,
    );

    return this.parseJson<MetaTokenResponse>(response);
  }

  async exchangeForLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
    const meta = this.getConfigOrThrow();
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: meta.appId,
      client_secret: meta.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(
      `${this.graphBase(meta)}/oauth/access_token?${params.toString()}`,
    );

    return this.parseJson<MetaTokenResponse>(response);
  }

  async fetchUserPages(accessToken: string): Promise<MetaPagesResponse> {
    const meta = this.getConfigOrThrow();
    const params = new URLSearchParams({
      fields: 'id,name,access_token,instagram_business_account',
      access_token: accessToken,
    });

    const response = await fetch(`${this.graphBase(meta)}/me/accounts?${params.toString()}`);

    return this.parseJson<MetaPagesResponse>(response);
  }

  async fetchInstagramProfile(
    instagramBusinessId: string,
    accessToken: string,
  ): Promise<InstagramProfile> {
    const meta = this.getConfigOrThrow();
    const params = new URLSearchParams({
      fields: 'id,username,profile_picture_url',
      access_token: accessToken,
    });

    const response = await fetch(
      `${this.graphBase(meta)}/${instagramBusinessId}?${params.toString()}`,
    );

    return this.parseJson<InstagramProfile>(response);
  }

  private graphBase(meta: MetaConfig): string {
    return `https://graph.facebook.com/${meta.graphApiVersion}`;
  }

  private async parseJson<T>(response: Response): Promise<T> {
    const body = (await response.json()) as T & MetaOAuthErrorResponse;

    if (!response.ok) {
      const message =
        body.error?.message ?? `Meta Graph API request failed (${response.status})`;
      throw new MetaGraphError(message, response.status >= 500 ? 502 : 400);
    }

    return body;
  }
}
