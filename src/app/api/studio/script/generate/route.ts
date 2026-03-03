import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getServerGeminiLlmApiBaseUrl, getServerOllamaLlmApiBaseUrl } from "@/lib/env";
import { createInternalServiceTokenCandidates, inferInternalServiceRole } from "@/lib/internal-service-auth";

type ScriptGenerationProvider = "gemini" | "ollama";
type GeminiThinkingLevel = "minimal" | "low" | "medium" | "high";
type OllamaThinkMode = "none" | "boolean" | "string";

type GenerateScriptRequestBody = {
  provider?: ScriptGenerationProvider;
  model?: string;
  brief?: string;
  outline?: string;
  prompt?: string;
  geminiThinkingLevel?: GeminiThinkingLevel;
  geminiThinkingBudget?: number;
  ollamaThinkMode?: OllamaThinkMode;
  ollamaThinkBoolean?: boolean;
  ollamaThinkString?: string;
};

type OllamaStreamAggregate = {
  content: string;
  thinking: string;
  modelUsed: string;
};

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizeProvider(value: unknown): ScriptGenerationProvider {
  return value === "ollama" ? "ollama" : "gemini";
}

function normalizeGeminiThinkingLevel(value: unknown): GeminiThinkingLevel {
  const level = getString(value).toLowerCase();
  if (level === "minimal" || level === "low" || level === "medium" || level === "high") {
    return level;
  }
  return "medium";
}

function composeScriptPrompt(outline: string, instruction: string): string {
  return [
    "你是一位资深剧本编辑，请根据输入的大纲和提示词生成可直接使用的中文剧本文稿。",
    "输出要求：",
    "1. 只输出剧本文稿正文，不要输出解释、标题前缀或多余说明。",
    "2. 保持清晰分段，叙事连贯，人物行动和情绪明确。",
    "3. 如果涉及对白，请使用易读格式，并保证上下文连贯。",
    "",
    "【大纲】",
    outline,
    "",
    "【提示词】",
    instruction,
  ].join("\n");
}

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  const error = getString(record.error);
  if (error) {
    return error;
  }
  const detail = getString(record.details);
  return detail;
}

function extractContent(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  return getString(record.content);
}

function extractModelUsed(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  return getString(record.model_used) || getString(record.model);
}

function extractThinking(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  return getString(record.thinking);
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

    const dataRaw = dataLines.join("\n");
    const payload = JSON.parse(dataRaw) as Record<string, unknown>;
    const nextModel = getString(payload.model);
    if (nextModel) {
      modelUsed = nextModel;
    }

    if (eventName === "token") {
      const content = getString(payload.content);
      if (content) {
        contentChunks.push(content);
      }
      return;
    }

    if (eventName === "thinking") {
      const thinking = getString(payload.thinking);
      if (thinking) {
        thinkingChunks.push(thinking);
      }
      return;
    }

    if (eventName === "error") {
      streamError =
        getString(payload.error) ||
        getString(payload.details) ||
        "Ollama 流式生成失败，请稍后重试";
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

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as GenerateScriptRequestBody | null;
  const provider = normalizeProvider(body?.provider);
  const mergedBrief = getString(body?.brief);
  const outline = mergedBrief || getString(body?.outline);
  const instruction = mergedBrief ? "请严格根据上述输入生成完整剧本文稿，保持结构清晰、语气统一、可直接用于分镜与配音。" : getString(body?.prompt);

  if (!outline) {
    return NextResponse.json({ error: "outline is required" }, { status: 400 });
  }
  if (!instruction) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const roles = session.user.roles ?? [];
  const internalRole = inferInternalServiceRole(roles);
  const subject = session.user.id || session.user.email || "studio-user";

  const tokens = createInternalServiceTokenCandidates({ subject, role: internalRole });

  const prompt = composeScriptPrompt(outline, instruction);
  const baseUrl = provider === "gemini" ? getServerGeminiLlmApiBaseUrl() : getServerOllamaLlmApiBaseUrl();
  const endpoint = `${baseUrl.replace(/\/$/, "")}/generate`;

  const upstreamBody: Record<string, unknown> = {
    prompt,
    stream: provider === "ollama",
  };

  if (provider === "gemini") {
    const model = getString(body?.model);
    if (model) {
      upstreamBody.model = model;
    }
    upstreamBody.thinking_level = normalizeGeminiThinkingLevel(body?.geminiThinkingLevel);
    const budget = getNumber(body?.geminiThinkingBudget);
    if (budget && budget > 0) {
      upstreamBody.thinking_budget = Math.floor(budget);
    }
  } else {
    const model = getString(body?.model);
    if (model) {
      upstreamBody.model = model;
    }

    const thinkMode: OllamaThinkMode =
      body?.ollamaThinkMode === "boolean" || body?.ollamaThinkMode === "string" ? body.ollamaThinkMode : "none";
    if (thinkMode === "boolean") {
      upstreamBody.think = body?.ollamaThinkBoolean ?? true;
    }
    if (thinkMode === "string") {
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

      if (provider === "ollama") {
        const aggregate = await aggregateOllamaStream(upstream);
        if (!aggregate.content) {
          return NextResponse.json({ error: "模型未返回剧本文本" }, { status: 502 });
        }

        return NextResponse.json({
          provider,
          content: aggregate.content,
          modelUsed: aggregate.modelUsed,
          thinking: aggregate.thinking,
        });
      }

      const payload = (await upstream.json().catch(() => null)) as unknown;
      const content = extractContent(payload);
      if (!content) {
        return NextResponse.json({ error: "模型未返回剧本文本" }, { status: 502 });
      }

      return NextResponse.json({
        provider,
        content,
        modelUsed: extractModelUsed(payload),
        thinking: "",
      });
    }

    if (lastAuthStatus) {
      return NextResponse.json(
        { error: `${lastAuthMessage}，请检查 INTERNAL_JWT_SECRET / INTERNAL_JWT_ISSUER / INTERNAL_JWT_AUDIENCE 是否与 LLM 服务一致` },
        { status: lastAuthStatus },
      );
    }
    return NextResponse.json({ error: "调用 LLM 服务失败（内部鉴权）" }, { status: 502 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `调用 ${provider === "gemini" ? "Gemini" : "Ollama"} 服务失败：${error.message}`
            : "调用 LLM 服务失败",
      },
      { status: 502 },
    );
  }
}
