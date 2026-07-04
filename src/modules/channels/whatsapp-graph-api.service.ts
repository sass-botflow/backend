import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiscoveredWhatsAppChannel,
  GRAPH_API_MAX_RETRIES,
  LEGACY_META_OAUTH_REDIRECT_URI,
  META_GRAPH_API_VERSION,
  META_WEBHOOK_SUBSCRIBED_FIELDS,
  META_WHATSAPP_OAUTH_REDIRECT_URI,
  MetaTokenExchangeResult,
} from './channels.constants';

interface MetaGraphError {
  error?: {
    message: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

interface MetaTokenResponse extends MetaGraphError {
  access_token?: string;
  expires_in?: number;
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

interface MetaDebugTokenResponse extends MetaGraphError {
  data?: {
    is_valid?: boolean;
    expires_at?: number;
    granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
    error?: { message?: string };
  };
}

interface MetaWabaDetailsResponse extends MetaGraphError {
  id?: string;
  name?: string;
  owner_business_info?: { id?: string; name?: string };
}

const RETRYABLE_GRAPH_CODES = new Set([1, 2, 4, 17, 341, 80007]);
const RETRYABLE_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504]);

@Injectable()
export class WhatsAppGraphApiService {
  private readonly logger = new Logger(WhatsAppGraphApiService.name);
  private readonly graphBase = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

  constructor(private readonly config: ConfigService) {}

  getRedirectUri(): string {
    const envMetaRedirectUri = process.env.META_REDIRECT_URI ?? '(undefined)';
    const envMetaWhatsappRedirectUri = process.env.META_WHATSAPP_REDIRECT_URI ?? '(undefined)';

    const configured =
      this.config.get<string>('META_WHATSAPP_REDIRECT_URI') ??
      this.config.get<string>('META_REDIRECT_URI');

    let resolved: string;

    if (!configured || configured === LEGACY_META_OAUTH_REDIRECT_URI) {
      resolved = META_WHATSAPP_OAUTH_REDIRECT_URI;
    } else if (configured.endsWith('/meta/callback')) {
      this.logger.warn(
        'Ignoring legacy META redirect URI; using canonical WhatsApp OAuth callback',
        { configured },
      );
      resolved = META_WHATSAPP_OAUTH_REDIRECT_URI;
    } else {
      resolved = configured;
    }

    this.logger.warn('[OAuth DEBUG] getRedirectUri()', {
      'process.env.META_REDIRECT_URI': envMetaRedirectUri,
      'process.env.META_WHATSAPP_REDIRECT_URI': envMetaWhatsappRedirectUri,
      redirect_uri_used: resolved,
    });

    return resolved;
  }

  async exchangeAuthorizationCode(code: string): Promise<MetaTokenExchangeResult> {
    this.logger.log('Exchanging Meta authorization code for access token');

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

  async discoverWhatsAppChannel(accessToken: string): Promise<DiscoveredWhatsAppChannel> {
    this.logger.log('Discovering WhatsApp Business account via Graph API');

    const wabaId = await this.resolveWabaIdFromAccessToken(accessToken);

    const waba = await this.get<MetaWabaDetailsResponse>(
      `/${wabaId}?fields=id,name,owner_business_info`,
      accessToken,
    );

    const phones = await this.get<MetaPhoneNumbersResponse>(
      `/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
      accessToken,
    );

    const phone = phones.data?.[0];
    if (!phone) {
      throw new BadRequestException(
        'No WhatsApp Business phone numbers found on the connected Meta account',
      );
    }

    this.logger.log('WhatsApp channel discovered', {
      businessId: waba.owner_business_info?.id ?? wabaId,
      wabaId,
      phoneNumberId: phone.id,
    });

    return {
      businessId: waba.owner_business_info?.id ?? wabaId,
      wabaId,
      phoneNumberId: phone.id,
      displayPhoneNumber: phone.display_phone_number ?? '',
      verifiedName: phone.verified_name ?? waba.name ?? '',
      businessName: waba.owner_business_info?.name ?? waba.name ?? '',
    };
  }

  private async resolveWabaIdFromAccessToken(accessToken: string): Promise<string> {
    const appToken = `${this.config.getOrThrow<string>('META_APP_ID')}|${this.config.getOrThrow<string>('META_APP_SECRET')}`;
    const url = new URL(`${this.graphBase}/debug_token`);
    url.searchParams.set('input_token', accessToken);
    url.searchParams.set('access_token', appToken);

    const data = await this.requestJson<MetaDebugTokenResponse>(url.toString());
    const wabaScope = data.data?.granular_scopes?.find(
      (scope) => scope.scope === 'whatsapp_business_management',
    );
    const wabaId = wabaScope?.target_ids?.[0];

    if (!wabaId) {
      throw new BadRequestException(
        'No WhatsApp Business account found in token. Complete Embedded Signup and ensure whatsapp_business_management scope was granted.',
      );
    }

    return wabaId;
  }

  async subscribeWabaToAppWebhooks(wabaId: string, accessToken: string): Promise<void> {
    this.logger.log('Subscribing WABA to application webhooks', { wabaId });

    const url = new URL(`${this.graphBase}/${wabaId}/subscribed_apps`);
    url.searchParams.set('access_token', accessToken);

    const data = await this.requestJson<MetaSubscribeResponse>(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscribed_fields: META_WEBHOOK_SUBSCRIBED_FIELDS.split(','),
      }),
    });

    if (data.success === false) {
      throw new BadRequestException(
        data.error?.message ??
          'Failed to subscribe WhatsApp Business Account to application webhooks',
      );
    }
  }

  async unsubscribeWabaFromAppWebhooks(wabaId: string, accessToken: string): Promise<void> {
    this.logger.log('Unsubscribing WABA from application webhooks', { wabaId });

    const url = new URL(`${this.graphBase}/${wabaId}/subscribed_apps`);
    url.searchParams.set('access_token', accessToken);

    await this.requestJson(url.toString(), { method: 'DELETE' });
  }

  async validateAccessToken(accessToken: string): Promise<{ expiresAt: Date | null }> {
    const appToken = `${this.config.getOrThrow<string>('META_APP_ID')}|${this.config.getOrThrow<string>('META_APP_SECRET')}`;
    const url = new URL(`${this.graphBase}/debug_token`);
    url.searchParams.set('input_token', accessToken);
    url.searchParams.set('access_token', appToken);

    const data = await this.requestJson<MetaDebugTokenResponse>(url.toString());

    if (!data.data?.is_valid) {
      throw new UnauthorizedException(
        data.data?.error?.message ?? 'WhatsApp access token is invalid or expired',
      );
    }

    const expiresAt =
      data.data.expires_at && data.data.expires_at > 0
        ? new Date(data.data.expires_at * 1000)
        : null;

    return { expiresAt };
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

    const data = await this.requestJson<MetaTokenResponse>(url.toString());

    if (!data.access_token) {
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
    return this.requestJson<T>(url.toString());
  }

  private async requestJson<T extends MetaGraphError>(
    url: string,
    init?: RequestInit,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= GRAPH_API_MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(15_000),
        });
        const data = (await response.json()) as T;

        if (!response.ok) {
          const retryable = this.isRetryable(response.status, data.error?.code);
          const message = data.error?.message ?? `Meta Graph API request failed (${response.status})`;

          this.logger.error('Meta Graph API request failed', {
            url: url.split('?')[0],
            status: response.status,
            code: data.error?.code,
            fbtraceId: data.error?.fbtrace_id,
            attempt,
            message,
          });

          if (!retryable || attempt === GRAPH_API_MAX_RETRIES) {
            if (response.status === 401 || data.error?.code === 190) {
              throw new UnauthorizedException(message);
            }
            throw new BadRequestException(message);
          }

          await this.delay(attempt * 500);
          continue;
        }

        this.logger.debug('Meta Graph API request succeeded', {
          url: url.split('?')[0],
          attempt,
        });

        return data;
      } catch (error) {
        lastError = error;
        if (
          error instanceof BadRequestException ||
          error instanceof UnauthorizedException ||
          attempt === GRAPH_API_MAX_RETRIES
        ) {
          throw error;
        }
        await this.delay(attempt * 500);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new BadRequestException('Meta Graph API request failed');
  }

  private isRetryable(status: number, code?: number): boolean {
    if (RETRYABLE_HTTP_STATUS.has(status)) return true;
    return code !== undefined && RETRYABLE_GRAPH_CODES.has(code);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
