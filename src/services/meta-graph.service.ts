import { getMetaConfig, type MetaConfig } from "../config/meta";
import type {
  InstagramProfile,
  MetaOAuthErrorResponse,
  MetaPagesResponse,
  MetaTokenResponse,
} from "../types/instagram-oauth";

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
  ) {
    super(message);
    this.name = "MetaGraphError";
  }
}

function graphBaseUrl(config: MetaConfig): string {
  return `https://graph.facebook.com/${config.graphApiVersion}`;
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & MetaOAuthErrorResponse;

  if (!response.ok) {
    const message =
      body.error?.message ?? `Meta Graph API request failed (${response.status})`;
    throw new MetaGraphError(message, response.status >= 500 ? 502 : 400);
  }

  return body;
}

export function buildMetaOAuthUrl(config: MetaConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    scope: config.scopes,
    response_type: "code",
    state,
  });

  return `https://www.facebook.com/${config.graphApiVersion}/dialog/oauth?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  config: MetaConfig,
): Promise<MetaTokenResponse> {
  const params = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code,
  });

  const response = await fetch(
    `${graphBaseUrl(config)}/oauth/access_token?${params.toString()}`,
  );

  return parseJson<MetaTokenResponse>(response);
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  config: MetaConfig,
): Promise<MetaTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(
    `${graphBaseUrl(config)}/oauth/access_token?${params.toString()}`,
  );

  return parseJson<MetaTokenResponse>(response);
}

export async function fetchUserPages(
  accessToken: string,
  config: MetaConfig,
): Promise<MetaPagesResponse> {
  const params = new URLSearchParams({
    fields: "id,name,access_token,instagram_business_account",
    access_token: accessToken,
  });

  const response = await fetch(`${graphBaseUrl(config)}/me/accounts?${params.toString()}`);

  return parseJson<MetaPagesResponse>(response);
}

export async function fetchInstagramProfile(
  instagramBusinessId: string,
  accessToken: string,
  config: MetaConfig,
): Promise<InstagramProfile> {
  const params = new URLSearchParams({
    fields: "id,username,profile_picture_url",
    access_token: accessToken,
  });

  const response = await fetch(
    `${graphBaseUrl(config)}/${instagramBusinessId}?${params.toString()}`,
  );

  return parseJson<InstagramProfile>(response);
}

export function getMetaConfigOrThrow(): MetaConfig {
  const config = getMetaConfig();
  if (!config) {
    throw new MetaGraphError(
      "Meta OAuth is not configured. Set META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.",
      503,
    );
  }
  return config;
}
