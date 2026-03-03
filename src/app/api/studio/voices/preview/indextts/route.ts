import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getServerIndexTtsApiBaseUrl } from "@/lib/env";
import { createInternalServiceTokenCandidates, inferInternalServiceRole } from "@/lib/internal-service-auth";

type VoicePreviewBody = {
  voicePresetId?: string;
  voiceId?: string;
  name?: string;
  gender?: string;
  text?: string;
  sampleAudioUrl?: string;
  model?: string;
  serverUrl?: string;
};

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  const direct = getString(record.error) || getString(record.message) || getString(record.detail);
  if (direct) {
    return direct;
  }
  const nestedError = record.error;
  if (nestedError && typeof nestedError === "object") {
    const nestedRecord = nestedError as Record<string, unknown>;
    return getString(nestedRecord.message) || getString(nestedRecord.error) || "";
  }
  return "";
}

function pickAudioUrl(payload: Record<string, unknown> | null): string {
  if (!payload) return "";
  const direct =
    getString(payload.audioUrl) ||
    getString(payload.audio_url) ||
    getString(payload.url) ||
    getString(payload.fileUrl) ||
    getString(payload.file_url) ||
    getString(payload.downloadUrl) ||
    getString(payload.download_url);
  if (direct) {
    return direct;
  }
  const data = payload.data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    return (
      getString(record.audioUrl) ||
      getString(record.audio_url) ||
      getString(record.url) ||
      getString(record.fileUrl) ||
      getString(record.file_url) ||
      ""
    );
  }
  return "";
}

function pickAudioBase64(payload: Record<string, unknown> | null): string {
  if (!payload) return "";
  const direct =
    getString(payload.audioBase64) ||
    getString(payload.audio_base64) ||
    getString(payload.base64) ||
    getString(payload.audioData);
  if (direct) {
    return direct;
  }
  const data = payload.data;
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    return (
      getString(record.audioBase64) ||
      getString(record.audio_base64) ||
      getString(record.base64) ||
      getString(record.audioData) ||
      ""
    );
  }
  return "";
}

function pickModelUsed(payload: Record<string, unknown> | null): string {
  if (!payload) return "";
  return getString(payload.modelUsed) || getString(payload.model_used) || getString(payload.model);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as VoicePreviewBody | null;
  const text = getString(body?.text);
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > 20) {
    return NextResponse.json({ error: "text must be <= 20 chars" }, { status: 400 });
  }

  const defaultEndpointBase = getServerIndexTtsApiBaseUrl().replace(/\/$/, "");
  if (!defaultEndpointBase) {
    return NextResponse.json({ error: "IndexTTS API 未配置" }, { status: 500 });
  }

  const path = getString(process.env.INDEXTTS_PREVIEW_PATH) || "/v1/preview";
  const customServerUrl = getString(body?.serverUrl);
  let endpoint = `${defaultEndpointBase}${path.startsWith("/") ? path : `/${path}`}`;
  if (customServerUrl) {
    let parsed: URL;
    try {
      parsed = new URL(customServerUrl);
    } catch {
      return NextResponse.json({ error: "预览服务器地址无效" }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "预览服务器地址只支持 http/https" }, { status: 400 });
    }
    const pathname = parsed.pathname.replace(/\/+$/, "");
    if (pathname && pathname !== "") {
      endpoint = parsed.toString().replace(/\/+$/, "");
    } else {
      endpoint = `${parsed.origin}${path.startsWith("/") ? path : `/${path}`}`;
    }
  }

  const subject = session.user.id || session.user.email || "studio-user";
  const role = inferInternalServiceRole(session.user.roles ?? []);
  const internalTokens = createInternalServiceTokenCandidates({ subject, role });
  const externalApiKey = getString(process.env.INDEXTTS_API_KEY);
  const authCandidates: Array<{ mode: "apiKey" | "internal"; token: string }> = [];
  if (externalApiKey) {
    authCandidates.push({ mode: "apiKey", token: externalApiKey });
  }
  for (const token of internalTokens) {
    authCandidates.push({ mode: "internal", token });
  }

  const upstreamBody: Record<string, unknown> = {
    text,
    voice_id: getString(body?.voiceId) || getString(body?.voicePresetId),
    voiceId: getString(body?.voiceId) || getString(body?.voicePresetId),
    name: getString(body?.name),
    gender: getString(body?.gender),
    sample_audio_url: getString(body?.sampleAudioUrl),
    sampleAudioUrl: getString(body?.sampleAudioUrl),
  };
  const model = getString(body?.model);
  if (model) {
    upstreamBody.model = model;
  }

  try {
    let lastAuthStatus = 0;
    let lastAuthMessage = "";

    for (const candidate of authCandidates) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (candidate.mode === "apiKey") {
        headers.Authorization = `Bearer ${candidate.token}`;
        headers["X-API-Key"] = candidate.token;
      } else {
        headers.Authorization = `Bearer ${candidate.token}`;
      }

      const upstream = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(upstreamBody),
        cache: "no-store",
        signal: AbortSignal.timeout(180_000),
      });

      const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
      if (!upstream.ok) {
        const payload = contentType.includes("application/json")
          ? ((await upstream.json().catch(() => null)) as Record<string, unknown> | null)
          : null;
        const message = extractErrorMessage(payload) || `Request failed (${upstream.status})`;
        if (upstream.status === 401 || upstream.status === 403) {
          lastAuthStatus = upstream.status;
          lastAuthMessage = message;
          continue;
        }
        return NextResponse.json({ error: message }, { status: upstream.status });
      }

      if (contentType.startsWith("audio/")) {
        const bytes = await upstream.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        return NextResponse.json({
          audioDataUrl: `data:${contentType};base64,${base64}`,
          modelUsed: model,
        });
      }

      const payload = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
      const audioUrl = pickAudioUrl(payload);
      const audioBase64 = pickAudioBase64(payload);
      const modelUsed = pickModelUsed(payload);
      if (!audioUrl && !audioBase64) {
        return NextResponse.json({ error: "IndexTTS 未返回可用音频" }, { status: 502 });
      }

      return NextResponse.json({
        audioUrl,
        audioDataUrl: audioBase64 ? `data:audio/mpeg;base64,${audioBase64}` : "",
        modelUsed,
        message: getString(payload?.message),
      });
    }

    if (lastAuthStatus) {
      return NextResponse.json(
        { error: `${lastAuthMessage}，请检查 IndexTTS 的鉴权配置或 API Key` },
        { status: lastAuthStatus },
      );
    }

    return NextResponse.json({ error: "调用 IndexTTS 预览服务失败（内部鉴权）" }, { status: 502 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? `调用 IndexTTS 预览服务失败：${error.message}` : "调用 IndexTTS 预览服务失败",
      },
      { status: 502 },
    );
  }
}
