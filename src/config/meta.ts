import { loadEnv } from "./env";

const INSTAGRAM_OAUTH_SCOPES = [
  "instagram_basic",
  "pages_show_list",
  "instagram_manage_messages",
  "business_management",
] as const;

export function getMetaConfig() {
  const env = loadEnv();

  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_REDIRECT_URI) {
    return null;
  }

  return {
    appId: env.META_APP_ID,
    appSecret: env.META_APP_SECRET,
    redirectUri: env.META_REDIRECT_URI,
    graphApiVersion: env.META_GRAPH_API_VERSION,
    frontendUrl: env.FRONTEND_URL,
    scopes: INSTAGRAM_OAUTH_SCOPES.join(","),
  };
}

export type MetaConfig = NonNullable<ReturnType<typeof getMetaConfig>>;
