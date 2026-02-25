import { apiRequest } from "@/lib/api/client";
import type { ApiMessageResponse, AuthUserProfile, UsersListResponse } from "@/types/auth";

export async function getCurrentUser(accessToken: string): Promise<AuthUserProfile> {
  return apiRequest<AuthUserProfile>("/v1/users/me", {
    accessToken,
  });
}

export async function updateCurrentUser(
  accessToken: string,
  input: {
    nickname?: string;
    avatar_seed?: string;
    avatar_background?: string;
  },
): Promise<AuthUserProfile> {
  return apiRequest<AuthUserProfile>("/v1/users/me", {
    method: "PATCH",
    accessToken,
    body: input,
  });
}

export async function changeCurrentUserPassword(
  accessToken: string,
  input: { current_password: string; new_password: string },
): Promise<ApiMessageResponse> {
  return apiRequest<ApiMessageResponse>("/v1/users/me/password", {
    method: "POST",
    accessToken,
    body: input,
  });
}

export async function listUsers(accessToken: string): Promise<UsersListResponse> {
  return apiRequest<UsersListResponse>("/v1/users", {
    accessToken,
  });
}

export async function updateUserRoles(
  accessToken: string,
  userID: string,
  roles: string[],
): Promise<ApiMessageResponse> {
  return apiRequest<ApiMessageResponse>(`/v1/users/${userID}/roles`, {
    method: "PATCH",
    accessToken,
    body: { roles },
  });
}
