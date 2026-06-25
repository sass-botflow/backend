import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { META_GRAPH_VERSION, WHATSAPP_OAUTH_SCOPES } from './whatsapp.constants';

interface MetaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface MetaBusinessesResponse {
  data?: Array<{ id: string; name?: string }>;
}

interface MetaWabaResponse {
  data?: Array<{ id: string; name?: string }>;
}

interface MetaPhoneNumbersResponse {
  data?: Array<{ id: string; display_phone_number?: string; verified_name?: string }>;
}

export interface MetaWhatsAppConnection {
  accessToken: string;
  businessAccountId: string;
  phoneNumberId: string;
}

@Injectable()
export class MetaGraphService {
  private readonly graphBase = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

  constructor(private readonly config: ConfigService) {}

  buildOAuthUrl(state: string): string {
    const clientId = this.config.getOrThrow<string>('META_APP_ID');
    const redirectUri = this.getRedirectUri();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: WHATSAPP_OAUTH_SCOPES,
      response_type: 'code',
    });

    return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  }

  getRedirectUri(): string {
    return this.config.getOrThrow<string>('META_OAUTH_REDIRECT_URI');
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('META_APP_ID'),
      client_secret: this.config.getOrThrow<string>('META_APP_SECRET'),
      redirect_uri: this.getRedirectUri(),
      code,
    });

    const response = await fetch(
      `${this.graphBase}/oauth/access_token?${params.toString()}`,
    );

    const data = (await response.json()) as MetaTokenResponse & { error?: { message: string } };

    if (!response.ok || !data.access_token) {
      throw new BadRequestException(
        data.error?.message ?? 'Failed to exchange authorization code for access token',
      );
    }

    return this.exchangeForLongLivedToken(data.access_token);
  }

  async exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.getOrThrow<string>('META_APP_ID'),
      client_secret: this.config.getOrThrow<string>('META_APP_SECRET'),
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(
      `${this.graphBase}/oauth/access_token?${params.toString()}`,
    );

    const data = (await response.json()) as MetaTokenResponse & { error?: { message: string } };

    if (!response.ok || !data.access_token) {
      return shortLivedToken;
    }

    return data.access_token;
  }

  async discoverWhatsAppConnection(accessToken: string): Promise<MetaWhatsAppConnection> {
    const businesses = await this.getJson<MetaBusinessesResponse>(
      `${this.graphBase}/me/businesses?fields=id,name`,
      accessToken,
    );

    const businessList = businesses.data ?? [];

    if (businessList.length === 0) {
      throw new BadRequestException(
        'No Meta Business accounts found for this Facebook user',
      );
    }

    for (const business of businessList) {
      const wabas = await this.getJson<MetaWabaResponse>(
        `${this.graphBase}/${business.id}/owned_whatsapp_business_accounts?fields=id,name`,
        accessToken,
      );

      for (const waba of wabas.data ?? []) {
        const phones = await this.getJson<MetaPhoneNumbersResponse>(
          `${this.graphBase}/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name`,
          accessToken,
        );

        const phone = phones.data?.[0];
        if (phone) {
          return {
            accessToken,
            businessAccountId: waba.id,
            phoneNumberId: phone.id,
          };
        }
      }
    }

    throw new BadRequestException(
      'No WhatsApp Business phone numbers found on the connected Meta account',
    );
  }

  private async getJson<T>(url: string, accessToken: string): Promise<T> {
    const response = await fetch(`${url}&access_token=${accessToken}`);
    const data = (await response.json()) as T & { error?: { message: string } };

    if (!response.ok) {
      throw new BadRequestException(
        (data as { error?: { message: string } }).error?.message ??
          'Meta Graph API request failed',
      );
    }

    return data;
  }
}
