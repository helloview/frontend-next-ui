import { getServerChatboxApiBaseUrl } from "@/lib/env";
import { createInternalServiceTokenCandidates, inferInternalServiceRole } from "@/lib/internal-service-auth";

type ChatboxHttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

type ChatboxServiceInput = {
  user: {
    id?: string;
    email?: string | null;
    roles?: string[];
  };
  path: string;
  method?: ChatboxHttpMethod;
  body?: unknown;
};

type ChatboxServiceSuccess<T> = {
  ok: true;
  status: number;
  payload: T;
};

type ChatboxServiceFailure = {
  ok: false;
  status: number;
  error: string;
};

export type ChatboxServiceResult<T> = ChatboxServiceSuccess<T> | ChatboxServiceFailure;

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const record = payload as Record<string, unknown>;
  return getString(record.error) || getString(record.details) || fallback;
}

export async function requestChatboxService<T>(input: ChatboxServiceInput): Promise<ChatboxServiceResult<T>> {
  const subject = input.user.id || input.user.email || "chatbox-user";
  const role = inferInternalServiceRole(input.user.roles);
  const tokens = createInternalServiceTokenCandidates({ subject, role });

  const baseUrl = getServerChatboxApiBaseUrl().replace(/\/$/, "");
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const endpoint = `${baseUrl}${path}`;

  let authFailureMessage = "";

  for (const token of tokens) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: input.method ?? "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(input.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
        cache: "no-store",
      });
    } catch (error) {
      return {
        ok: false,
        status: 502,
        error: error instanceof Error ? `无法连接 Chatbox 服务：${error.message}` : "无法连接 Chatbox 服务",
      };
    }

    const payload = (await response.json().catch(() => null)) as unknown;

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        payload: payload as T,
      };
    }

    if (response.status === 401 || response.status === 403) {
      authFailureMessage = readErrorMessage(payload, "Chatbox 服务鉴权失败");
      continue;
    }

    return {
      ok: false,
      status: response.status,
      error: readErrorMessage(payload, `Chatbox 请求失败 (${response.status})`),
    };
  }

  return {
    ok: false,
    status: 502,
    error: authFailureMessage
      ? `${authFailureMessage}，请检查 INTERNAL_JWT_SECRET / INTERNAL_JWT_ISSUER / INTERNAL_JWT_AUDIENCE`
      : "Chatbox 服务调用失败（内部鉴权）",
  };
}
