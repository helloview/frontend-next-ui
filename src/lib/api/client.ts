import { getPublicUmsApiBaseUrl, getServerUmsApiBaseUrl } from "@/lib/env";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string;
  cache?: RequestCache;
  baseUrl?: string;
};

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function resolveBaseUrl(): string {
  return typeof window === "undefined" ? getServerUmsApiBaseUrl() : getPublicUmsApiBaseUrl();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const baseUrl = options.baseUrl ?? resolveBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: options.cache ?? "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiRequestError(response.status, payload?.error ?? `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
