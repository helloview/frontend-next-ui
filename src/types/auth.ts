export type AuthUserProfile = {
  id: string;
  email: string;
  nickname: string;
  avatar_seed?: string;
  avatar_background?: string;
  roles: string[];
  scopes: string[];
  status: string;
  token_version?: number;
  created_at?: string;
  updated_at?: string;
};

export type TokenPairResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
  user: AuthUserProfile;
};

export type UsersListResponse = {
  items: AuthUserProfile[];
  count: number;
};

export type ApiMessageResponse = {
  message: string;
};
