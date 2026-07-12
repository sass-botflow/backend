export type InstagramOAuthFlow = 'instagram' | 'facebook';

export interface MetaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export interface MetaOAuthErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
}

export interface MetaPageAccount {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: {
    id: string;
  };
}

export interface MetaPagesResponse {
  data?: MetaPageAccount[];
  paging?: { next?: string };
  error?: MetaOAuthErrorResponse['error'];
}

export interface InstagramProfile {
  id: string;
  user_id?: string;
  username?: string;
  profile_picture_url?: string;
  account_type?: string;
}

export interface InstagramLoginTokenData {
  access_token: string;
  user_id: string;
  permissions?: string;
}

export interface InstagramLoginTokenResponse {
  access_token?: string;
  user_id?: string | number;
  data?: InstagramLoginTokenData[];
}

export interface InstagramConnectionData {
  instagramUserId: string;
  instagramBusinessId: string;
  username: string;
  profilePictureUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  accountType?: string | null;
}
