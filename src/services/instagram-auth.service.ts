import jwt from "jsonwebtoken";
import { loadEnv } from "../config/env";
import { prisma } from "../lib/prisma";
import type { InstagramConnectionData } from "../types/instagram-oauth";
import {
  buildMetaOAuthUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchInstagramProfile,
  fetchUserPages,
  getMetaConfigOrThrow,
  MetaGraphError,
} from "./meta-graph.service";

const env = loadEnv();

const OAUTH_STATE_PURPOSE = "instagram_oauth";

export class InstagramOAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "InstagramOAuthError";
  }
}

export function signInstagramOAuthState(userId: string): string {
  return jwt.sign({ userId, purpose: OAUTH_STATE_PURPOSE }, env.JWT_SECRET, {
    expiresIn: "15m",
  });
}

export function verifyInstagramOAuthState(state: string): string {
  try {
    const payload = jwt.verify(state, env.JWT_SECRET) as {
      userId?: string;
      purpose?: string;
    };

    if (payload.purpose !== OAUTH_STATE_PURPOSE || !payload.userId) {
      throw new InstagramOAuthError("Invalid OAuth state.", "invalid_state");
    }

    return payload.userId;
  } catch (error) {
    if (error instanceof InstagramOAuthError) {
      throw error;
    }
    throw new InstagramOAuthError(
      "OAuth state is invalid or expired. Please try connecting again.",
      "invalid_state",
    );
  }
}

export function getInstagramAuthorizeUrl(userId: string): string {
  const config = getMetaConfigOrThrow();
  const state = signInstagramOAuthState(userId);
  return buildMetaOAuthUrl(config, state);
}

function tokenExpiresAt(expiresIn?: number): Date | null {
  if (!expiresIn || expiresIn <= 0) {
    return null;
  }
  return new Date(Date.now() + expiresIn * 1000);
}

async function resolveInstagramAccount(
  userAccessToken: string,
): Promise<InstagramConnectionData> {
  const config = getMetaConfigOrThrow();

  const pages = await fetchUserPages(userAccessToken, config);
  const pageWithInstagram = pages.data?.find(
    (page) => page.instagram_business_account?.id,
  );

  if (!pageWithInstagram?.instagram_business_account?.id) {
    throw new InstagramOAuthError(
      "No Instagram Business account linked to your Facebook Pages. Connect an Instagram Business account in Meta Business Suite first.",
      "no_instagram_business_account",
    );
  }

  const instagramBusinessId = pageWithInstagram.instagram_business_account.id;
  const pageAccessToken = pageWithInstagram.access_token ?? userAccessToken;

  const profile = await fetchInstagramProfile(
    instagramBusinessId,
    pageAccessToken,
    config,
  );

  if (!profile.username) {
    throw new InstagramOAuthError(
      "Could not retrieve Instagram username from Meta.",
      "profile_fetch_failed",
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

export async function handleInstagramCallback(
  code: string,
  state: string,
): Promise<{ userId: string; username: string }> {
  if (!code?.trim()) {
    throw new InstagramOAuthError("Authorization code is missing.", "missing_code");
  }

  const userId = verifyInstagramOAuthState(state);
  const config = getMetaConfigOrThrow();

  const shortLived = await exchangeCodeForToken(code, config);
  const longLived = await exchangeForLongLivedToken(shortLived.access_token, config);

  const connectionData = await resolveInstagramAccount(longLived.access_token);
  const expiresAt = tokenExpiresAt(longLived.expires_in);

  await prisma.instagramConnection.upsert({
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

export function mapOAuthServiceError(error: unknown): InstagramOAuthError {
  if (error instanceof InstagramOAuthError) {
    return error;
  }

  if (error instanceof MetaGraphError) {
    return new InstagramOAuthError(error.message, "meta_api_error", error.statusCode);
  }

  return new InstagramOAuthError(
    "An unexpected error occurred during Instagram connection.",
    "unknown_error",
    500,
  );
}
