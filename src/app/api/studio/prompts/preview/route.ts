import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { updateWorkspacePromptTemplate } from "@/lib/studio-api";
import { getServerGeminiLlmApiBaseUrl, getServerOllamaLlmApiBaseUrl } from "@/lib/env";
import { createInternalServiceTokenCandidates, inferInternalServiceRole } from "@/lib/internal-service-auth";

type PreviewProvider = "gemini" | "ollama";
type GeminiThinkingLevel = "minimal" | "low" | "medium" | "high";
type OllamaThinkMode = "none" | "boolean" | "string";

type PromptPreviewBody = {
  prompt?: string;
  model?: string;
  promptId?: string;
  provider?: PreviewProvider;
  geminiThinkingLevel?: GeminiThinkingLevel;
  ollamaThinkMode?: OllamaThinkMode;
  ollamaThinkBoolean?: boolean;
  ollamaThinkString?: string;
};

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProvider(value: unknown): PreviewProvider {
  return value === "gemini" ? "gemini" : "ollama";
}

function normalizeGeminiThinkingLevel(value: unknown): GeminiThinkingLevel {
  const level = getString(value).toLowerCase();
  if (level === "minimal" || level === "low" || level === "medium" || level === "high") {
    return level;
  }
  return "medium";
}

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  const direct = getString(record.error) || getString(record.message) || getString(record.detail) || getString(record.details);
  if (direct) {
    return direct;
  }
  const nested = record.error;
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>;
    return getString(nestedRecord.message) || getString(nestedRecord.error) || "";
  }
  return "";
}

function extractContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  return getString(record.content) || getString(record.text) || getString(record.output);
}

function extractThinking(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  return getString(record.thinking);
}

function extractModel(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  return getString(record.model) || getString(record.model_used) || getString(record.modelUsed);
}

async function readUpstreamErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as unknown;
    return extractErrorMessage(payload) || `Request failed (${response.status})`;
  }
  const text = await response.text().catch(() => "");
  return getString(text) || `Request failed (${response.status})`;
}

type OllamaStreamAggregate = {
  content: string;
  thinking: string;
  modelUsed: string;
};

function parseSSEDataLine(line: string): string {
  return line.replace(/^data:\s?/, "");
}

async function aggregateOllamaStream(upstream: Response): Promise<OllamaStreamAggregate> {
  const reader = upstream.body?.getReader();
  if (!reader) {
    throw new Error("Ollama 流式响应为空");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  const contentChunks: string[] = [];
  const thinkingChunks: string[] = [];
  let modelUsed = "";
  let streamError = "";

  const consumeChunk = (rawEvent: string) => {
    const normalized = rawEvent.replace(/\r/g, "");
    const lines = normalized.split("\n");
    let eventName = "message";
    const dataLines: string[] = [];

    lines.forEach((line) => {
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim();
        return;
      }
      if (line.startsWith("data:")) {
        dataLines.push(parseSSEDataLine(line));
      }
    });

    if (!dataLines.length) {
      return;
    }

    const payload = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
    const model = getString(payload.model);
    if (model) {
      modelUsed = model;
    }
    if (eventName === "token") {
      const content = getString(payload.content);
      if (content) contentChunks.push(content);
      return;
    }
    if (eventName === "thinking") {
      const thinking = getString(payload.thinking);
      if (thinking) thinkingChunks.push(thinking);
      return;
    }
    if (eventName === "error") {
      streamError = getString(payload.error) || getString(payload.details) || "Ollama 预览生成失败";
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
    }
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const eventChunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (eventChunk.trim()) {
        consumeChunk(eventChunk);
      }
      boundary = buffer.indexOf("\n\n");
    }
    if (done) {
      const tail = buffer.trim();
      if (tail) {
        consumeChunk(tail);
      }
      break;
    }
  }

  if (streamError) {
    throw new Error(streamError);
  }

  return {
    content: contentChunks.join("").trim(),
    thinking: thinkingChunks.join("").trim(),
    modelUsed,
  };
}

function composePreviewPrompt(sourcePrompt: string): string {
  return [
    "你是一位专业中文创作助手。",
    "请基于下面的提示词内容，输出一版更清晰、结构化、可直接复用的优化版本。",
    "输出要求：",
    "1. 仅输出优化后的中文正文，不要解释。",
    "2. 保留用户原始意图，不要偏题。",
    "3. 语言紧凑，避免重复。",
    "",
    "【提示词内容】",
    sourcePrompt,
  ].join("\n");
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as PromptPreviewBody | null;
  const sourcePrompt = getString(body?.prompt);
  const promptId = getString(body?.promptId);
  const provider = normalizeProvider(body?.provider);

  if (!sourcePrompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!session.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = inferInternalServiceRole(session.user.roles ?? []);
  const subject = session.user.id || session.user.email || "studio-user";
  const tokens = createInternalServiceTokenCandidates({ subject, role });

  const endpoint = `${(provider === "gemini" ? getServerGeminiLlmApiBaseUrl() : getServerOllamaLlmApiBaseUrl()).replace(/\/$/, "")}/generate`;
  const upstreamBody: Record<string, unknown> = {
    prompt: composePreviewPrompt(sourcePrompt),
    stream: provider === "ollama",
  };
  const model = getString(body?.model);
  if (model) {
    upstreamBody.model = model;
  }
  if (provider === "gemini") {
    upstreamBody.thinking_level = normalizeGeminiThinkingLevel(body?.geminiThinkingLevel);
  } else {
    const mode: OllamaThinkMode = body?.ollamaThinkMode === "boolean" || body?.ollamaThinkMode === "string" ? body.ollamaThinkMode : "none";
    if (mode === "boolean") {
      upstreamBody.think = body?.ollamaThinkBoolean ?? true;
    }
    if (mode === "string") {
      const thinkString = getString(body?.ollamaThinkString);
      if (thinkString) {
        upstreamBody.think = thinkString;
      }
    }
  }

  try {
    let lastAuthStatus = 0;
    let lastAuthMessage = "";
    const requestTimeoutMs = provider === "ollama" ? 600_000 : 120_000;

    for (const token of tokens) {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(upstreamBody),
        cache: "no-store",
        signal: AbortSignal.timeout(requestTimeoutMs),
      });

      if (!upstream.ok) {
        const message = await readUpstreamErrorMessage(upstream);
        if (upstream.status === 401 || upstream.status === 403) {
          lastAuthStatus = upstream.status;
          lastAuthMessage = message;
          continue;
        }
        return NextResponse.json({ error: message }, { status: upstream.status });
      }

      let content = "";
      let thinking = "";
      let modelUsed = "";

      if (provider === "ollama") {
        const aggregate = await aggregateOllamaStream(upstream);
        content = aggregate.content;
        thinking = aggregate.thinking;
        modelUsed = aggregate.modelUsed;
      } else {
        const payload = (await upstream.json().catch(() => null)) as unknown;
        content = extractContent(payload);
        thinking = extractThinking(payload);
        modelUsed = extractModel(payload);
      }

      if (!content) {
        return NextResponse.json({ error: "预览模型未返回内容" }, { status: 502 });
      }

      if (promptId) {
        try {
          await updateWorkspacePromptTemplate({
            accessToken: session.accessToken,
            promptId,
            previewResult: content,
          });
        } catch (error) {
          return NextResponse.json(
            {
              error: error instanceof Error ? `预览结果保存失败：${error.message}` : "预览结果保存失败",
            },
            { status: 502 },
          );
        }
      }

      return NextResponse.json({
        content,
        thinking,
        modelUsed,
        provider,
      });
    }

    if (lastAuthStatus) {
      return NextResponse.json(
        { error: `${lastAuthMessage}，请检查 INTERNAL_JWT_SECRET / INTERNAL_JWT_ISSUER / INTERNAL_JWT_AUDIENCE 是否与 LLM 服务一致` },
        { status: lastAuthStatus },
      );
    }

    return NextResponse.json({ error: "调用预览服务失败（内部鉴权）" }, { status: 502 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? `调用预览服务失败：${error.message}` : "调用预览服务失败",
      },
      { status: 502 },
    );
  }
}
