import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiscoveredWhatsAppAccount,
  META_GRAPH_API_VERSION,
  META_WEBHOOK_SUBSCRIBED_FIELDS,
  MetaTokenExchangeResult,
} from './meta.constants';

interface MetaGraphError {
  error?: {
    message: string;
    type?: string;
    code?: number;
  };
}

interface MetaTokenResponse extends MetaGraphError {
  access_token?: string;
  expires_in?: number;
}

interface MetaBusinessesResponse extends MetaGraphError {
  data?: Array<{ id: string; name?: string }>;
}

interface MetaWabaResponse extends MetaGraphError {
  data?: Array<{ id: string; name?: string }>;
}

interface MetaPhoneNumbersResponse extends MetaGraphError {
  data?: Array<{
    id: string;
    display_phone_number?: string;
    verified_name?: string;
  }>;
}

interface MetaSubscribeResponse extends MetaGraphError {
  success?: boolean;
}

@Injectable()
export class MetaGraphApiService {
  private readonly logger = new Logger(MetaGraphApiService.name);
  private readonly graphBase = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

  constructor(private readonly config: ConfigService) {}

  async exchangeAuthorizationCode(code: string): Promise<MetaTokenExchangeResult> {
    const shortLived = await this.requestToken({
      client_id: this.config.getOrThrow<string>('META_APP_ID'),
      client_secret: this.config.getOrThrow<string>('META_APP_SECRET'),
      redirect_uri: this.getRedirectUri(),
      code,
    });

    const longLived = await this.exchangeForLongLivedToken(shortLived.accessToken);

    return {
      accessToken: longLived.accessToken,
      expiresIn: longLived.expiresIn ?? shortLived.expiresIn,
    };
  }

  async discoverWhatsAppAccount(accessToken: string): Promise<DiscoveredWhatsAppAccount> {
    const businesses = await this.get<MetaBusinessesResponse>(
      '/me/businesses?fields=id,name',
      accessToken,
    );

    const businessList = businesses.data ?? [];

    if (businessList.length === 0) {
      throw new BadRequestException(
        'No Meta Business accounts found for this Facebook user',
      );
    }

    for (const business of businessList) {
      const wabas = await this.get<MetaWabaResponse>(
        `/${business.id}/owned_whatsapp_business_accounts?fields=id,name`,
        accessToken,
      );

      for (const waba of wabas.data ?? []) {
        const phones = await this.get<MetaPhoneNumbersResponse>(
          `/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name`,
          accessToken,
        );

        const phone = phones.data?.[0];
        if (!phone) continue;

        return {
          wabaId: waba.id,
          phoneNumberId: phone.id,
          displayPhoneNumber: phone.display_phone_number ?? '',
          verifiedName: phone.verified_name ?? waba.name ?? '',
          businessName: business.name ?? waba.name ?? '',
        };
      }
    }

    throw new BadRequestException(
      'No WhatsApp Business phone numbers found on the connected Meta account',
    );
  }

  async subscribeWabaToAppWebhooks(wabaId: string, accessToken: string): Promise<void> {
    const url = new URL(`${this.graphBase}/${wabaId}/subscribed_apps`);
    url.searchParams.set('access_token', accessToken);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscribed_fields: META_WEBHOOK_SUBSCRIBED_FIELDS.split(','),
      }),
    });

    const data = (await response.json()) as MetaSubscribeResponse;

    if (!response.ok || data.success === false) {
      this.logger.error('WABA webhook subscription failed', {
        wabaId,
        error: data.error?.message,
      });
      throw new BadRequestException(
        data.error?.message ??
          'Failed to subscribe WhatsApp Business Account to application webhooks',
      );
    }
  }

  private async exchangeForLongLivedToken(
    shortLivedToken: string,
  ): Promise<MetaTokenExchangeResult> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.getOrThrow<string>('META_APP_ID'),
      client_secret: this.config.getOrThrow<string>('META_APP_SECRET'),
      fb_exchange_token: shortLivedToken,
    });

    try {
      return await this.requestToken(Object.fromEntries(params.entries()));
    } catch {
      return { accessToken: shortLivedToken, expiresIn: null };
    }
  }

  private async requestToken(
    params: Record<string, string>,
  ): Promise<MetaTokenExchangeResult> {
    const url = new URL(`${this.graphBase}/oauth/access_token`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    const response = await fetch(url.toString());
    const data = (await response.json()) as MetaTokenResponse;

    if (!response.ok || !data.access_token) {
      throw new BadRequestException(
        data.error?.message ?? 'Failed to exchange authorization code for access token',
      );
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? null,
    };
  }

  private async get<T extends MetaGraphError>(path: string, accessToken: string): Promise<T> {
    const url = new URL(`${this.graphBase}${path}`);
    url.searchParams.set('access_token', accessToken);

    const response = await fetch(url.toString());
    const data = (await response.json()) as T;

    if (!response.ok) {
      this.logger.error('Meta Graph API request failed', {
        path,
        error: data.error?.message,
      });
      throw new BadRequestException(
        data.error?.message ?? 'Meta Graph API request failed',
      );
    }

    return data;
  }

  getRedirectUri(): string {
    return this.config.getOrThrow<string>('META_REDIRECT_URI');
  }
}
