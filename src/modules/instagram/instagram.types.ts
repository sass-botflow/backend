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
  error?: MetaOAuthErrorResponse['error'];
}

export interface InstagramProfile {
  id: string;
  username?: string;
  profile_picture_url?: string;
}

export interface InstagramConnectionData {
  instagramUserId: string;
  instagramBusinessId: string;
  username: string;
  profilePictureUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}
