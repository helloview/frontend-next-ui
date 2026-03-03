import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getServerGeminiLlmApiBaseUrl, getServerOllamaLlmApiBaseUrl } from "@/lib/env";
import { createInternalServiceTokenCandidates, inferInternalServiceRole } from "@/lib/internal-service-auth";

type ProviderModelsPayload = {
  service?: string;
  textModels?: string[];
  imageModels?: string[];
  defaultTextModel?: string;
  defaultImageModel?: string;
  text_models?: string[];
  image_models?: string[];
  default_text_model?: string;
  default_image_model?: string;
  thinking?: {
    supportsLevel?: boolean;
    levelOptions?: string[];
    supportsBudget?: boolean;
    supportsBoolean?: boolean;
    supportsString?: boolean;
    stringSuggestions?: string[];
  };
};

type ProviderCatalog = {
  textModels: string[];
  imageModels: string[];
  defaultTextModel: string;
  defaultImageModel: string;
  thinking: {
    supportsLevel: boolean;
    levelOptions: string[];
    supportsBudget: boolean;
    supportsBoolean: boolean;
    supportsString: boolean;
    stringSuggestions: string[];
  };
};

type ProviderKey = "gemini" | "ollama";

function formatFetchFailure(endpoint: string, error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause && typeof cause === "object") {
      const record = cause as Record<string, unknown>;
      const code = getString(record.code);
      const address = getString(record.address);
      const port = String(record.port ?? "").trim();
      if (code || address || port) {
        return `无法连接 ${endpoint}（${[code, address, port].filter(Boolean).join(" ") || "network error"}）`;
      }
    }
    if (error.message && error.message !== "fetch failed") {
      return `无法连接 ${endpoint}（${error.message}）`;
    }
  }
  return `无法连接 ${endpoint}`;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function normalizeCatalog(payload: ProviderModelsPayload | null): ProviderCatalog {
  const textModels = normalizeStringArray(payload?.textModels ?? payload?.text_models);
  const imageModels = normalizeStringArray(payload?.imageModels ?? payload?.image_models);
  const defaultTextModel = getString(payload?.defaultTextModel ?? payload?.default_text_model) || textModels[0] || "";
  const defaultImageModel = getString(payload?.defaultImageModel ?? payload?.default_image_model) || imageModels[0] || "";

  return {
    textModels,
    imageModels,
    defaultTextModel,
    defaultImageModel,
    thinking: {
      supportsLevel: Boolean(payload?.thinking?.supportsLevel),
      levelOptions: normalizeStringArray(payload?.thinking?.levelOptions),
      supportsBudget: Boolean(payload?.thinking?.supportsBudget),
      supportsBoolean: Boolean(payload?.thinking?.supportsBoolean),
      supportsString: Boolean(payload?.thinking?.supportsString),
      stringSuggestions: normalizeStringArray(payload?.thinking?.stringSuggestions),
    },
  };
}

function parseEnvModelList(value: string | undefined): string[] {
  return normalizeStringArray((value ?? "").split(","));
}

function buildGeminiFallbackCatalog(): ProviderCatalog {
  const configuredTextModels = parseEnvModelList(process.env.GEMINI_TEXT_MODELS);
  const textModels = configuredTextModels.length
    ? configuredTextModels
    : ["gemini-3.1-pro-preview", "gemini-3.1-pro-preview-customtools", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash"];
  const configuredImageModels = parseEnvModelList(process.env.GEMINI_IMAGE_MODELS);
  const imageModels = configuredImageModels.length
    ? configuredImageModels
    : ["gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"];

  return {
    textModels,
    imageModels,
    defaultTextModel: getString(process.env.GEMINI_DEFAULT_TEXT_MODEL) || textModels[0] || "",
    defaultImageModel: getString(process.env.GEMINI_DEFAULT_IMAGE_MODEL) || imageModels[0] || "",
    thinking: {
      supportsLevel: true,
      levelOptions: ["minimal", "low", "medium", "high"],
      supportsBudget: true,
      supportsBoolean: false,
      supportsString: false,
      stringSuggestions: [],
    },
  };
}

function isUnauthorizedStatus(status: number): boolean {
  return status === 401 || status === 403;
}

function buildModelEndpointCandidates(baseUrl: string): string[] {
  const normalized = baseUrl.replace(/\/+$/, "");
  const candidates = [`${normalized}/models`];
  if (normalized.endsWith("/v1")) {
    candidates.push(`${normalized.slice(0, -3)}/models`);
  } else {
    candidates.push(`${normalized}/v1/models`);
  }
  return Array.from(new Set(candidates));
}

async function fetchProviderModels(baseUrl: string, tokens: string[]): Promise<ProviderModelsPayload> {
  const endpoints = buildModelEndpointCandidates(baseUrl);
  const unauthorizedErrors: string[] = [];

  for (const endpoint of endpoints) {
    let lastUnauthorizedError = "";
    let endpointNotFound = false;

    for (const token of tokens) {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          signal: AbortSignal.timeout(20_000),
        });
      } catch (error) {
        throw new Error(formatFetchFailure(endpoint, error));
      }

      const payload = (await response.json().catch(() => null)) as
        | ({ error?: string } & ProviderModelsPayload)
        | null;
      if (response.ok) {
        return payload ?? {};
      }

      const error = getString(payload?.error) || `Request failed (${response.status})`;
      if (isUnauthorizedStatus(response.status)) {
        lastUnauthorizedError = error;
        continue;
      }
      if (response.status === 404) {
        endpointNotFound = true;
        break;
      }
      throw new Error(error);
    }

    if (lastUnauthorizedError) {
      unauthorizedErrors.push(lastUnauthorizedError);
    }
    if (!endpointNotFound) {
      break;
    }
  }

  if (unauthorizedErrors.length > 0) {
    throw new Error(`${unauthorizedErrors[0]}（请检查 INTERNAL_JWT_SECRET / INTERNAL_JWT_ISSUER / INTERNAL_JWT_AUDIENCE）`);
  }

  throw new Error("Request failed (404)");
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subject = session.user.id || session.user.email || "studio-user";
  const role = inferInternalServiceRole(session.user.roles ?? []);
  const tokens = createInternalServiceTokenCandidates({ subject, role });

  const warnings: string[] = [];
  const warningsByProvider: Partial<Record<ProviderKey, string>> = {};

  const [geminiResult, ollamaResult] = await Promise.allSettled([
    fetchProviderModels(getServerGeminiLlmApiBaseUrl(), tokens),
    fetchProviderModels(getServerOllamaLlmApiBaseUrl(), tokens),
  ]);

  const geminiCatalog =
    geminiResult.status === "fulfilled"
      ? normalizeCatalog(geminiResult.value)
      : buildGeminiFallbackCatalog();
  if (geminiResult.status === "rejected") {
    const reasonMessage = geminiResult.reason instanceof Error ? geminiResult.reason.message : "unknown error";
    const message = /404/.test(reasonMessage)
      ? "Gemini 模型清单接口暂不可用，已回退为本地配置模型列表。"
      : `Gemini 模型清单获取失败：${reasonMessage}`;
    warnings.push(message);
    warningsByProvider.gemini = message;
  }

  const ollamaCatalog =
    ollamaResult.status === "fulfilled"
      ? normalizeCatalog(ollamaResult.value)
      : normalizeCatalog({
          textModels: [],
          imageModels: [],
          defaultTextModel: "",
          defaultImageModel: "",
        });
  if (ollamaResult.status === "rejected") {
    const message = `Ollama 模型清单获取失败：${ollamaResult.reason instanceof Error ? ollamaResult.reason.message : "unknown error"}`;
    warnings.push(message);
    warningsByProvider.ollama = message;
  }

  return NextResponse.json({
    providers: {
      gemini: geminiCatalog,
      ollama: ollamaCatalog,
    },
    warnings,
    warningsByProvider,
  });
}
