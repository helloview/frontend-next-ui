import { apiRequest } from "@/lib/api/client";
import type { ApiMessageResponse, TokenPairResponse } from "@/types/auth";

type CredentialsInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  email: string;
  password: string;
  nickname: string;
};

export async function loginWithCredentials(input: CredentialsInput): Promise<TokenPairResponse> {
  return apiRequest<TokenPairResponse>("/v1/auth/login", {
    method: "POST",
    body: input,
  });
}

export async function registerWithCredentials(input: RegisterInput): Promise<TokenPairResponse> {
  return apiRequest<TokenPairResponse>("/v1/auth/register", {
    method: "POST",
    body: input,
  });
}

export async function exchangeGoogleIdToken(idToken: string): Promise<TokenPairResponse> {
  return apiRequest<TokenPairResponse>("/v1/auth/oauth/google", {
    method: "POST",
    body: { id_token: idToken },
  });
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenPairResponse> {
  return apiRequest<TokenPairResponse>("/v1/auth/refresh", {
    method: "POST",
    body: { refresh_token: refreshToken },
  });
}

export async function requestPasswordReset(email: string): Promise<ApiMessageResponse> {
  return apiRequest<ApiMessageResponse>("/v1/auth/password/reset/request", {
    method: "POST",
    body: { email },
  });
}

export async function confirmPasswordReset(input: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<ApiMessageResponse> {
  return apiRequest<ApiMessageResponse>("/v1/auth/password/reset/confirm", {
    method: "POST",
    body: {
      email: input.email,
      code: input.code,
      new_password: input.newPassword,
    },
  });
}
