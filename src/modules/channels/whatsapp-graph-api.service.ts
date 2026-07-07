import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiscoveredWhatsAppChannel,
  EmbeddedSignupDiscoveryContext,
  EmbeddedSignupDiscoveryState,
  EmbeddedSignupScenario,
  GRAPH_API_MAX_RETRIES,
  LEGACY_META_OAUTH_REDIRECT_URI,
  META_GRAPH_API_VERSION,
  META_WEBHOOK_SUBSCRIBED_FIELDS,
  META_WHATSAPP_OAUTH_REDIRECT_URI,
  MetaTokenExchangeResult,
  WhatsAppPhoneNumberDetails,
} from './channels.constants';

interface MetaGraphErrorBody {
  message: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

interface MetaGraphError {
  error?: MetaGraphErrorBody;
}

interface MetaTokenResponse extends MetaGraphError {
  access_token?: string;
  expires_in?: number;
}

interface MetaPhoneNumberResponse extends MetaGraphError {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
  status?: string;
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

interface MetaBusinessListResponse extends MetaGraphError {
  data?: Array<{ id: string; name?: string }>;
}

interface MetaWabaListResponse extends MetaGraphError {
  data?: Array<{ id: string; name?: string }>;
}

export interface DiscoveredWhatsAppChannelWithScenario extends DiscoveredWhatsAppChannel {
  scenario: EmbeddedSignupScenario;
}

const RETRYABLE_GRAPH_CODES = new Set([1, 2, 4, 17, 341, 80007]);
const RETRYABLE_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export class MetaGraphApiException extends Error {
  constructor(
    readonly operation: string,
    readonly httpStatus: number,
    readonly metaResponse: unknown,
    message?: string,
  ) {
    super(message ?? MetaGraphApiException.extractMessage(metaResponse));
    this.name = 'MetaGraphApiException';
  }

  getPublicMessage(): string {
    return this.message;
  }

  private static extractMessage(metaResponse: unknown): string {
    if (
      metaResponse &&
      typeof metaResponse === 'object' &&
      'error' in metaResponse &&
      metaResponse.error &&
      typeof metaResponse.error === 'object' &&
      'message' in metaResponse.error &&
      typeof metaResponse.error.message === 'string'
    ) {
      return metaResponse.error.message;
    }

    return 'Meta Graph API request failed';
  }
}

@Injectable()
export class WhatsAppGraphApiService {
  private readonly logger = new Logger(WhatsAppGraphApiService.name);
  private readonly graphBase = `https://graph.facebook.com/${META_GRAPH_API_VERSION}`;

  constructor(private readonly config: ConfigService) {}

  getRedirectUri(): string {
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

    return resolved;
  }

  /** Embedded Signup code exchange — no redirect_uri (Meta JS SDK flow). */
  async exchangeEmbeddedSignupCode(code: string): Promise<MetaTokenExchangeResult> {
    this.logger.log('Exchanging Embedded Signup authorization code for access token');

    const shortLived = await this.requestToken('exchangeEmbeddedSignupCode', {
      client_id: this.config.getOrThrow<string>('META_APP_ID'),
      client_secret: this.config.getOrThrow<string>('META_APP_SECRET'),
      code,
    });

    const longLived = await this.exchangeForLongLivedToken(shortLived.accessToken);

    return {
      accessToken: longLived.accessToken,
      expiresIn: longLived.expiresIn ?? shortLived.expiresIn,
    };
  }

  async exchangeAuthorizationCode(code: string): Promise<MetaTokenExchangeResult> {
    this.logger.log('Exchanging Meta authorization code for access token');

    const shortLived = await this.requestToken('exchangeAuthorizationCode', {
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

  async getPhoneNumberDetails(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<WhatsAppPhoneNumberDetails> {
    const data = await this.get<MetaPhoneNumberResponse>(
      'getPhoneNumberDetails',
      `/${phoneNumberId}?fields=id,display_phone_number,verified_name,status`,
      accessToken,
    );

    if (!data.id) {
      throw new MetaGraphApiException(
        'getPhoneNumberDetails',
        400,
        data,
        data.error?.message ?? 'WhatsApp phone number not found or not accessible',
      );
    }

    return {
      id: data.id,
      displayPhoneNumber: data.display_phone_number ?? '',
      verifiedName: data.verified_name ?? '',
      status: data.status ?? '',
    };
  }

  async registerPhoneNumberIfNeeded(
    phoneNumberId: string,
    accessToken: string,
  ): Promise<void> {
    const details = await this.getPhoneNumberDetails(phoneNumberId, accessToken);

    if (details.status === 'CONNECTED') {
      this.logger.log('Phone number already registered for Cloud API', { phoneNumberId });
      return;
    }

    const pin =
      this.config.get<string>('META_WHATSAPP_REGISTRATION_PIN') ??
      this.generateRegistrationPin();

    this.logger.log('Registering phone number for Cloud API', { phoneNumberId });

    const url = new URL(`${this.graphBase}/${phoneNumberId}/register`);
    url.searchParams.set('access_token', accessToken);

    try {
      await this.requestJson('registerPhoneNumber', url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          pin,
        }),
      });
    } catch (error) {
      if (error instanceof MetaGraphApiException) {
        const message = error.message.toLowerCase();
        if (message.includes('already registered') || message.includes('registered')) {
          this.logger.log('Phone number registration skipped (already registered)', {
            phoneNumberId,
          });
          return;
        }
      }
      throw error;
    }
  }

  async discoverWhatsAppChannel(
    accessToken: string,
  ): Promise<DiscoveredWhatsAppChannelWithScenario> {
    const discovery = await this.runEmbeddedSignupDiscovery(accessToken);
    return {
      businessId: discovery.businessId,
      wabaId: discovery.wabaId,
      phoneNumberId: discovery.phoneNumberId,
      displayPhoneNumber: discovery.displayPhoneNumber,
      verifiedName: discovery.verifiedName,
      businessName: discovery.businessName,
      scenario: discovery.scenario,
    };
  }

  async initEmbeddedSignupDiscovery(
    accessToken: string,
  ): Promise<{ context: EmbeddedSignupDiscoveryContext; debugData: MetaDebugTokenResponse }> {
    const debugData = await this.getDebugTokenData(accessToken);
    return {
      context: this.buildDiscoveryContext(debugData),
      debugData,
    };
  }

  async discoverBusinessManager(
    accessToken: string,
    context: EmbeddedSignupDiscoveryContext,
    debugData: MetaDebugTokenResponse,
  ): Promise<{ businessId: string; businessName: string }> {
    if (context.businessId) {
      return {
        businessId: context.businessId,
        businessName: context.businessName ?? context.businessId,
      };
    }

    const businesses = await this.listUserBusinesses(accessToken);
    if (businesses[0]?.id) {
      return {
        businessId: businesses[0].id,
        businessName: businesses[0].name ?? businesses[0].id,
      };
    }

    const businessId = await this.resolveBusinessIdFromToken(accessToken, debugData);
    if (!businessId) {
      throw new MetaGraphApiException(
        'discoverBusiness',
        404,
        { context },
        'No Business Manager found. Complete Meta Embedded Signup and link or create a Business Manager.',
      );
    }

    return { businessId, businessName: businessId };
  }

  async discoverWabaAccount(
    accessToken: string,
    context: EmbeddedSignupDiscoveryContext,
    businessId: string,
  ): Promise<{ wabaId: string; businessId: string; businessName: string }> {
    const wabaId = await this.resolveWabaId(accessToken, {
      ...context,
      businessId,
    });

    const waba = await this.get<MetaWabaDetailsResponse>(
      'getWabaDetails',
      `/${wabaId}?fields=id,name,owner_business_info`,
      accessToken,
    );

    const resolvedBusinessId = waba.owner_business_info?.id ?? businessId;
    const businessName = waba.owner_business_info?.name ?? waba.name ?? resolvedBusinessId;

    return {
      wabaId,
      businessId: resolvedBusinessId,
      businessName,
    };
  }

  async discoverPhoneNumber(
    accessToken: string,
    wabaId: string,
    context: EmbeddedSignupDiscoveryContext,
  ): Promise<{
    phoneNumberId: string;
    displayPhoneNumber: string;
    verifiedName: string;
  }> {
    const phoneNumberId = await this.resolvePhoneNumberId(accessToken, wabaId, context);
    const phone = await this.getPhoneNumberDetails(phoneNumberId, accessToken);

    if (phone.status !== 'CONNECTED') {
      await this.registerPhoneNumberIfNeeded(phoneNumberId, accessToken);
    }

    return {
      phoneNumberId,
      displayPhoneNumber: phone.displayPhoneNumber,
      verifiedName: phone.verifiedName,
    };
  }

  private async runEmbeddedSignupDiscovery(
    accessToken: string,
  ): Promise<EmbeddedSignupDiscoveryState> {
    this.logger.log('Discovering WhatsApp channel from Meta Graph API (all scenarios)');

    const { context, debugData } = await this.initEmbeddedSignupDiscovery(accessToken);
    const business = await this.discoverBusinessManager(accessToken, context, debugData);
    const waba = await this.discoverWabaAccount(accessToken, context, business.businessId);
    const phone = await this.discoverPhoneNumber(accessToken, waba.wabaId, context);

    const scenario = this.inferScenario(context, {
      businessId: waba.businessId,
      wabaId: waba.wabaId,
      phoneNumberId: phone.phoneNumberId,
    });

    this.logger.log('WhatsApp channel discovered from Meta Graph API', {
      scenario,
      businessId: waba.businessId,
      businessName: waba.businessName,
      wabaId: waba.wabaId,
      phoneNumberId: phone.phoneNumberId,
      displayPhoneNumber: phone.displayPhoneNumber,
    });

    return {
      context,
      businessId: waba.businessId,
      businessName: waba.businessName,
      wabaId: waba.wabaId,
      phoneNumberId: phone.phoneNumberId,
      displayPhoneNumber: phone.displayPhoneNumber,
      verifiedName: phone.verifiedName,
      scenario,
    };
  }

  private buildDiscoveryContext(
    debugData: MetaDebugTokenResponse,
  ): EmbeddedSignupDiscoveryContext {
    const scopes = debugData.data?.granular_scopes ?? [];

    const wabaIds = this.getScopeTargetIds(scopes, 'whatsapp_business_management');
    const phoneIds = this.getScopeTargetIds(scopes, 'whatsapp_business_messaging');
    const businessIds = this.getScopeTargetIds(scopes, 'business_management');

    return {
      wabaId: wabaIds[0],
      phoneNumberId: phoneIds[0],
      businessId: businessIds[0],
      scenario: 'new_setup',
    };
  }

  private inferScenario(
    context: EmbeddedSignupDiscoveryContext,
    resolved: { businessId: string; wabaId: string; phoneNumberId: string },
  ): EmbeddedSignupScenario {
    if (context.phoneNumberId && context.wabaId && context.businessId) {
      return 'existing_phone';
    }

    if (context.phoneNumberId && context.wabaId) {
      return 'existing_phone';
    }

    if (context.wabaId && !context.phoneNumberId) {
      return 'existing_waba';
    }

    if (context.businessId && !context.wabaId) {
      return 'existing_business';
    }

    if (context.businessId) {
      return 'existing_business';
    }

    if (context.wabaId) {
      return 'existing_waba';
    }

    return 'new_setup';
  }

  private getScopeTargetIds(
    scopes: Array<{ scope: string; target_ids?: string[] }>,
    scopeName: string,
  ): string[] {
    const match = scopes.find((scope) => scope.scope === scopeName);
    return match?.target_ids?.filter((id) => Boolean(id?.trim())) ?? [];
  }

  private async getDebugTokenData(accessToken: string): Promise<MetaDebugTokenResponse> {
    const appToken = `${this.config.getOrThrow<string>('META_APP_ID')}|${this.config.getOrThrow<string>('META_APP_SECRET')}`;
    const url = new URL(`${this.graphBase}/debug_token`);
    url.searchParams.set('input_token', accessToken);
    url.searchParams.set('access_token', appToken);

    const data = await this.requestJson<MetaDebugTokenResponse>('debugToken', url.toString());

    if (!data.data?.is_valid) {
      throw new MetaGraphApiException(
        'debugToken',
        401,
        data,
        data.data?.error?.message ?? 'Meta access token is invalid or expired',
      );
    }

    return data;
  }

  private async resolveWabaId(
    accessToken: string,
    context: EmbeddedSignupDiscoveryContext,
  ): Promise<string> {
    if (context.wabaId) {
      return context.wabaId;
    }

    const businessId =
      context.businessId ?? (await this.resolveBusinessIdFromToken(accessToken));

    if (businessId) {
      const fromBusiness = await this.resolveWabaFromBusiness(businessId, accessToken);
      if (fromBusiness) {
        return fromBusiness;
      }
    }

    this.logger.error('No WABA found after Embedded Signup discovery', { context });
    throw new MetaGraphApiException(
      'discoverWaba',
      400,
      { context },
      'No WhatsApp Business account found. Complete Embedded Signup in Meta and ensure whatsapp_business_management scope was granted.',
    );
  }

  private async resolveBusinessIdFromToken(
    accessToken: string,
    debugData?: MetaDebugTokenResponse,
  ): Promise<string> {
    const tokenData = debugData ?? (await this.getDebugTokenData(accessToken));
    const businessIds = this.getScopeTargetIds(
      tokenData.data?.granular_scopes ?? [],
      'business_management',
    );

    if (businessIds[0]) {
      return businessIds[0];
    }

    const businesses = await this.listUserBusinesses(accessToken);
    return businesses[0]?.id ?? '';
  }

  private async listUserBusinesses(
    accessToken: string,
  ): Promise<Array<{ id: string; name?: string }>> {
    const data = await this.get<MetaBusinessListResponse>(
      'listUserBusinesses',
      '/me/businesses?fields=id,name',
      accessToken,
    );

    return data.data ?? [];
  }

  private async resolveWabaFromBusiness(
    businessId: string,
    accessToken: string,
  ): Promise<string | null> {
    const owned = await this.get<MetaWabaListResponse>(
      'listOwnedWabas',
      `/${businessId}/owned_whatsapp_business_accounts?fields=id,name`,
      accessToken,
    );

    if (owned.data?.[0]?.id) {
      return owned.data[0].id;
    }

    const client = await this.get<MetaWabaListResponse>(
      'listClientWabas',
      `/${businessId}/client_whatsapp_business_accounts?fields=id,name`,
      accessToken,
    );

    return client.data?.[0]?.id ?? null;
  }

  private async resolvePhoneNumberId(
    accessToken: string,
    wabaId: string,
    context: EmbeddedSignupDiscoveryContext,
  ): Promise<string> {
    if (context.phoneNumberId) {
      return context.phoneNumberId;
    }

    const phones = await this.get<MetaPhoneNumbersResponse>(
      'listPhoneNumbers',
      `/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
      accessToken,
    );

    const phone = this.selectBestPhoneNumber(phones.data ?? []);
    if (!phone?.id) {
      this.logger.error('No WhatsApp phone numbers returned from Meta Graph API', {
        wabaId,
        metaResponse: phones,
      });
      throw new MetaGraphApiException(
        'listPhoneNumbers',
        404,
        phones,
        'No WhatsApp Business phone number found. Add or verify a phone number in Meta Embedded Signup.',
      );
    }

    return phone.id;
  }

  private selectBestPhoneNumber(
    phones: Array<{ id: string; display_phone_number?: string; verified_name?: string }>,
  ): { id: string; display_phone_number?: string; verified_name?: string } | undefined {
    if (phones.length === 0) {
      return undefined;
    }

    if (phones.length === 1) {
      return phones[0];
    }

    return phones.find((phone) => Boolean(phone.display_phone_number)) ?? phones[0];
  }

  async subscribeWabaToAppWebhooks(wabaId: string, accessToken: string): Promise<void> {
    this.logger.log('Subscribing WABA to application webhooks', { wabaId });

    const url = new URL(`${this.graphBase}/${wabaId}/subscribed_apps`);
    url.searchParams.set('access_token', accessToken);

    const data = await this.requestJson<MetaSubscribeResponse>(
      'subscribeWabaWebhooks',
      url.toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscribed_fields: META_WEBHOOK_SUBSCRIBED_FIELDS.split(','),
        }),
      },
    );

    if (data.success === false) {
      throw new MetaGraphApiException(
        'subscribeWabaWebhooks',
        400,
        data,
        data.error?.message ??
          'Failed to subscribe WhatsApp Business Account to application webhooks',
      );
    }
  }

  async unsubscribeWabaFromAppWebhooks(wabaId: string, accessToken: string): Promise<void> {
    this.logger.log('Unsubscribing WABA from application webhooks', { wabaId });

    const url = new URL(`${this.graphBase}/${wabaId}/subscribed_apps`);
    url.searchParams.set('access_token', accessToken);

    await this.requestJson('unsubscribeWabaWebhooks', url.toString(), { method: 'DELETE' });
  }

  async validateAccessToken(accessToken: string): Promise<{ expiresAt: Date | null }> {
    const appToken = `${this.config.getOrThrow<string>('META_APP_ID')}|${this.config.getOrThrow<string>('META_APP_SECRET')}`;
    const url = new URL(`${this.graphBase}/debug_token`);
    url.searchParams.set('input_token', accessToken);
    url.searchParams.set('access_token', appToken);

    const data = await this.requestJson<MetaDebugTokenResponse>('validateAccessToken', url.toString());

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
      return await this.requestToken(
        'exchangeForLongLivedToken',
        Object.fromEntries(params.entries()),
      );
    } catch (error) {
      if (error instanceof MetaGraphApiException) {
        this.logger.warn('Long-lived token exchange failed; using short-lived token', {
          metaResponse: error.metaResponse,
        });
      }
      return { accessToken: shortLivedToken, expiresIn: null };
    }
  }

  private async requestToken(
    operation: string,
    params: Record<string, string>,
  ): Promise<MetaTokenExchangeResult> {
    const url = new URL(`${this.graphBase}/oauth/access_token`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    const data = await this.requestJson<MetaTokenResponse>(operation, url.toString());

    if (!data.access_token) {
      throw new MetaGraphApiException(
        operation,
        400,
        data,
        data.error?.message ?? 'Failed to exchange authorization code for access token',
      );
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in ?? null,
    };
  }

  private async get<T extends MetaGraphError>(
    operation: string,
    path: string,
    accessToken: string,
  ): Promise<T> {
    const url = new URL(`${this.graphBase}${path}`);
    url.searchParams.set('access_token', accessToken);
    return this.requestJson<T>(operation, url.toString());
  }

  private async requestJson<T extends MetaGraphError>(
    operation: string,
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

          this.logger.error('Meta Graph API request failed', {
            operation,
            url: url.split('?')[0],
            status: response.status,
            attempt,
            metaResponse: data,
          });

          if (!retryable || attempt === GRAPH_API_MAX_RETRIES) {
            if (response.status === 401 || data.error?.code === 190) {
              throw new UnauthorizedException(
                data.error?.message ?? 'Meta Graph API authorization failed',
              );
            }
            throw new MetaGraphApiException(
              operation,
              response.status,
              data,
              data.error?.message ?? `Meta Graph API request failed (${response.status})`,
            );
          }

          await this.delay(attempt * 500);
          continue;
        }

        if (data.error) {
          this.logger.error('Meta Graph API returned error payload on success status', {
            operation,
            url: url.split('?')[0],
            attempt,
            metaResponse: data,
          });
          throw new MetaGraphApiException(
            operation,
            200,
            data,
            data.error.message,
          );
        }

        this.logger.debug('Meta Graph API request succeeded', {
          operation,
          url: url.split('?')[0],
          attempt,
        });

        return data;
      } catch (error) {
        lastError = error;
        if (
          error instanceof MetaGraphApiException ||
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
      : new MetaGraphApiException(operation, 500, lastError, 'Meta Graph API request failed');
  }

  private isRetryable(status: number, code?: number): boolean {
    if (RETRYABLE_HTTP_STATUS.has(status)) return true;
    return code !== undefined && RETRYABLE_GRAPH_CODES.has(code);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private generateRegistrationPin(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
}
