import NextAuth, { type NextAuthConfig, type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";

import { exchangeGoogleIdToken, loginWithCredentials, refreshAccessToken } from "@/lib/auth-api";
import type { TokenPairResponse } from "@/types/auth";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type AppUser = User & {
  roles: string[];
  scopes: string[];
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
};

type RefreshReplayEntry = {
  payload: TokenPairResponse;
  expiresAt: number;
};

type GlobalAuthRefreshState = {
  __helloviewRefreshInflight?: Map<string, Promise<TokenPairResponse>>;
  __helloviewRefreshReplay?: Map<string, RefreshReplayEntry>;
};

function toNextAuthUser(payload: Awaited<ReturnType<typeof loginWithCredentials>>): AppUser {
  return {
    id: payload.user.id,
    email: payload.user.email,
    name: payload.user.nickname || payload.user.email,
    roles: payload.user.roles,
    scopes: payload.user.scopes,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    accessTokenExpiresAt: Date.now() + payload.expires_in * 1000,
  };
}

function isAppUser(user: unknown): user is AppUser {
  if (!user || typeof user !== "object") {
    return false;
  }

  const candidate = user as Partial<AppUser>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.accessToken === "string" &&
    typeof candidate.refreshToken === "string" &&
    typeof candidate.accessTokenExpiresAt === "number" &&
    Array.isArray(candidate.roles) &&
    Array.isArray(candidate.scopes)
  );
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function isFatalRefreshError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  // Be conservative here. Transient gateway / clock-skew / race conditions can
  // surface as 401 once; we should not immediately force logout on first hit.
  const fatalHints = [
    "invalid refresh",
    "refresh token expired",
    "refresh token revoked",
    "missing refresh token",
    "token revoked",
    "reused refresh token",
  ];
  return fatalHints.some((hint) => message.includes(hint));
}

function getRefreshInflightMap() {
  const state = globalThis as typeof globalThis & GlobalAuthRefreshState;
  if (!state.__helloviewRefreshInflight) {
    state.__helloviewRefreshInflight = new Map<string, Promise<TokenPairResponse>>();
  }
  return state.__helloviewRefreshInflight;
}

function getRefreshReplayMap() {
  const state = globalThis as typeof globalThis & GlobalAuthRefreshState;
  if (!state.__helloviewRefreshReplay) {
    state.__helloviewRefreshReplay = new Map<string, RefreshReplayEntry>();
  }
  return state.__helloviewRefreshReplay;
}

async function refreshAccessTokenWithDedup(refreshToken: string): Promise<TokenPairResponse> {
  const now = Date.now();
  const replay = getRefreshReplayMap();
  for (const [key, entry] of replay.entries()) {
    if (entry.expiresAt <= now) {
      replay.delete(key);
    }
  }

  const replayHit = replay.get(refreshToken);
  if (replayHit && replayHit.expiresAt > now) {
    return replayHit.payload;
  }

  const inflight = getRefreshInflightMap();
  const existing = inflight.get(refreshToken);
  if (existing) {
    return existing;
  }

  const request = refreshAccessToken(refreshToken)
    .then((payload) => {
      // Allow near-simultaneous requests carrying the old cookie to reuse this result
      // and avoid refresh-token rotation races.
      replay.set(refreshToken, {
        payload,
        expiresAt: Date.now() + 15_000,
      });
      return payload;
    })
    .finally(() => {
      inflight.delete(refreshToken);
    });

  inflight.set(refreshToken, request);
  return request;
}

const providers: NonNullable<NextAuthConfig["providers"]> = [
  Credentials({
    name: "Email + Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = credentialsSchema.safeParse(credentials);
      if (!parsed.success) {
        return null;
      }

      const payload = await loginWithCredentials(parsed.data).catch(() => null);
      if (!payload) {
        return null;
      }

      return toNextAuthUser(payload);
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

const authConfig: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "credentials" && isAppUser(user)) {
        token.sub = user.id;
        token.email = user.email ?? undefined;
        token.name = user.name ?? undefined;
        token.roles = user.roles;
        token.scopes = user.scopes;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpiresAt = user.accessTokenExpiresAt;
        token.refreshFailureCount = 0;
        token.error = undefined;
        return token;
      }

      if (account?.provider === "google" && account.id_token) {
        try {
          const payload = await exchangeGoogleIdToken(account.id_token);
          token.sub = payload.user.id;
          token.email = payload.user.email;
          token.name = payload.user.nickname;
          token.roles = payload.user.roles;
          token.scopes = payload.user.scopes;
          token.accessToken = payload.access_token;
          token.refreshToken = payload.refresh_token;
          token.accessTokenExpiresAt = Date.now() + payload.expires_in * 1000;
          token.refreshFailureCount = 0;
          token.error = undefined;
        } catch {
          token.error = "OAuthExchangeFailed";
        }

        return token;
      }

      const accessToken = getString(token.accessToken);
      const accessTokenExpiresAt = getNumber(token.accessTokenExpiresAt);
      
      // Refresh token if it's within 10 minutes of expiration
      // (Default Access Token TTL is 15 mins, so this rotates it every 5 mins)
      if (
        accessToken &&
        accessTokenExpiresAt &&
        Date.now() < accessTokenExpiresAt - 600_000
      ) {
        return token;
      }

      const refreshToken = getString(token.refreshToken);
      if (!refreshToken) {
        token.error = "MissingRefreshToken";
        return token;
      }

      try {
        const payload = await refreshAccessTokenWithDedup(refreshToken);
        token.accessToken = payload.access_token;
        token.refreshToken = payload.refresh_token;
        token.accessTokenExpiresAt = Date.now() + payload.expires_in * 1000;
        token.roles = payload.user.roles;
        token.scopes = payload.user.scopes;
        token.scopeBackfillAttempted = true;
        token.refreshFailureCount = 0;
        token.error = undefined;
      } catch (error) {
        const refreshFailureCount = (getNumber(token.refreshFailureCount) ?? 0) + 1;
        token.refreshFailureCount = refreshFailureCount;

        // Avoid aggressive forced logout. Even on fatal-like refresh failures,
        // keep current token state and let UI guide user to re-login manually.
        // This prevents sudden /login redirects during temporary network/auth jitter.
        if (isFatalRefreshError(error) && refreshFailureCount >= 2) {
          token.error = "RefreshTokenExpired";
        } else {
          token.error = "RefreshAccessTokenTransientError";
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.email = getString(token.email) ?? "";
        session.user.name = getString(token.name) ?? "";
        session.user.roles = getStringArray(token.roles);
        session.user.scopes = getStringArray(token.scopes);
      }

      session.accessToken = getString(token.accessToken);
      session.refreshToken = getString(token.refreshToken);
      session.accessTokenExpiresAt = getNumber(token.accessTokenExpiresAt);
      session.error = getString(token.error);
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
