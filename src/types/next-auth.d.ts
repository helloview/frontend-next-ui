import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    error?: string;
    user: DefaultSession["user"] & {
      id: string;
      roles: string[];
      scopes: string[];
    };
  }

  interface User {
    id: string;
    email?: string | null;
    name?: string | null;
    roles: string[];
    scopes: string[];
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
    roles?: string[];
    scopes?: string[];
    error?: string;
  }
}
