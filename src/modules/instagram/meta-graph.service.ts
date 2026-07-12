import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getMetaConfig, type MetaConfig } from './meta.config';
import type {
  InstagramLoginTokenResponse,
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

  /** Facebook Login — legacy flow via Facebook dialog */
  buildFacebookOAuthUrl(state: string): string {
    const meta = this.getConfigOrThrow();
    const params = new URLSearchParams({
      client_id: meta.appId,
      redirect_uri: meta.redirectUri,
      scope: meta.facebookScopes,
      response_type: 'code',
      state,
    });

    return `https://www.facebook.com/${meta.graphApiVersion}/dialog/oauth?${params.toString()}`;
  }

  /** Instagram Login — direct IG OAuth (Creator/Business, no FB Page required) */
  buildInstagramLoginUrl(state: string): string {
    const meta = this.getConfigOrThrow();
    const params = new URLSearchParams({
      client_id: meta.appId,
      redirect_uri: meta.redirectUri,
      scope: meta.instagramLoginScopes,
      response_type: 'code',
      state,
    });

    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeFacebookCodeForToken(code: string): Promise<MetaTokenResponse> {
    const meta = this.getConfigOrThrow();
    const params = new URLSearchParams({
      client_id: meta.appId,
      client_secret: meta.appSecret,
      redirect_uri: meta.redirectUri,
      code,
    });

    const response = await fetch(
      `${this.facebookGraphBase(meta)}/oauth/access_token?${params.toString()}`,
    );

    return this.parseJson<MetaTokenResponse>(response);
  }

  async exchangeForLongLivedFacebookToken(
    shortLivedToken: string,
  ): Promise<MetaTokenResponse> {
    const meta = this.getConfigOrThrow();
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: meta.appId,
      client_secret: meta.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(
      `${this.facebookGraphBase(meta)}/oauth/access_token?${params.toString()}`,
    );

    return this.parseJson<MetaTokenResponse>(response);
  }

  async exchangeInstagramLoginCode(code: string): Promise<{
    accessToken: string;
    userId: string;
  }> {
    const meta = this.getConfigOrThrow();
    const body = new URLSearchParams({
      client_id: meta.appId,
      client_secret: meta.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: meta.redirectUri,
      code,
    });

    const response = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const parsed = await this.parseJson<InstagramLoginTokenResponse>(response);
    const entry = parsed.data?.[0];

    const accessToken = entry?.access_token ?? parsed.access_token;
    const userId = entry?.user_id ?? parsed.user_id;

    if (!accessToken || userId === undefined || userId === null) {
      throw new MetaGraphError('Instagram token response missing access_token or user_id.', 502);
    }

    return {
      accessToken,
      userId: String(userId),
    };
  }

  async exchangeInstagramLongLivedToken(shortLivedToken: string): Promise<MetaTokenResponse> {
    const meta = this.getConfigOrThrow();
    const params = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: meta.appSecret,
      access_token: shortLivedToken,
    });

    const response = await fetch(
      `https://graph.instagram.com/access_token?${params.toString()}`,
    );

    return this.parseJson<MetaTokenResponse>(response);
  }

  async fetchInstagramLoginProfile(accessToken: string): Promise<InstagramProfile> {
    const meta = this.getConfigOrThrow();
    const params = new URLSearchParams({
      fields: 'user_id,username,account_type,profile_picture_url',
      access_token: accessToken,
    });

    const response = await fetch(
      `https://graph.instagram.com/${meta.graphApiVersion}/me?${params.toString()}`,
    );

    return this.parseJson<InstagramProfile>(response);
  }

  async fetchAllUserPages(accessToken: string): Promise<MetaPagesResponse['data']> {
    const meta = this.getConfigOrThrow();
    const pages: NonNullable<MetaPagesResponse['data']> = [];
    let nextUrl: string | null =
      `${this.facebookGraphBase(meta)}/me/accounts?` +
      new URLSearchParams({
        fields: 'id,name,access_token,instagram_business_account',
        access_token: accessToken,
        limit: '100',
      }).toString();

    while (nextUrl) {
      const response = await fetch(nextUrl);
      const body = await this.parseJson<MetaPagesResponse>(response);
      if (body.data?.length) {
        pages.push(...body.data);
      }
      nextUrl = body.paging?.next ?? null;
    }

    return pages;
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
      `${this.facebookGraphBase(meta)}/${instagramBusinessId}?${params.toString()}`,
    );

    return this.parseJson<InstagramProfile>(response);
  }

  private facebookGraphBase(meta: MetaConfig): string {
    return `https://graph.facebook.com/${meta.graphApiVersion}`;
  }

  private async parseJson<T>(response: Response): Promise<T> {
    const body = (await response.json()) as T & MetaOAuthErrorResponse;

    if (!response.ok) {
      const message =
        body.error?.message ?? `Meta API request failed (${response.status})`;
      throw new MetaGraphError(message, response.status >= 500 ? 502 : 400);
    }

    return body;
  }
}
