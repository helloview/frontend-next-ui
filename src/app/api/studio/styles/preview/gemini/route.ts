import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getServerGeminiLlmApiBaseUrl } from "@/lib/env";
import { createInternalServiceTokenCandidates, inferInternalServiceRole } from "@/lib/internal-service-auth";

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
  const nested = record.error;
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>;
    return getString(nestedRecord.message) || getString(nestedRecord.error) || "";
  }
  return "";
}

type GenerateStylePreviewBody = {
  prompt?: string;
  model?: string;
  referenceImages?: string[];
  aspectRatio?: string;
  resolution?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as GenerateStylePreviewBody | null;
  const prompt = getString(body?.prompt);
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const role = inferInternalServiceRole(session.user.roles ?? []);
  const subject = session.user.id || session.user.email || "studio-user";
  const tokens = createInternalServiceTokenCandidates({ subject, role });

  const endpoint = `${getServerGeminiLlmApiBaseUrl().replace(/\/$/, "")}/generate-image`;
  const upstreamBody: Record<string, unknown> = {
    prompt,
  };
  const model = getString(body?.model);
  if (model) {
    upstreamBody.model = model;
  }
  const aspectRatio = getString(body?.aspectRatio);
  if (aspectRatio) {
    upstreamBody.aspect_ratio = aspectRatio;
  }
  const resolution = getString(body?.resolution);
  if (resolution) {
    upstreamBody.resolution = resolution;
  }
  if (Array.isArray(body?.referenceImages) && body.referenceImages.length > 0) {
    upstreamBody.reference_images = body.referenceImages.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  try {
    let lastAuthStatus = 0;
    let lastAuthMessage = "";

    for (const token of tokens) {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(upstreamBody),
        cache: "no-store",
        signal: AbortSignal.timeout(180_000),
      });

      const payload = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
      if (!upstream.ok) {
        const message = extractErrorMessage(payload) || `Request failed (${upstream.status})`;
        if (upstream.status === 401 || upstream.status === 403) {
          lastAuthStatus = upstream.status;
          lastAuthMessage = message;
          continue;
        }
        return NextResponse.json({ error: message }, { status: upstream.status });
      }

      const imageUrl = getString(payload?.image_url) || getString(payload?.imageUrl);
      const imageBase64 = getString(payload?.image_base64) || getString(payload?.imageBase64);
      if (!imageUrl && !imageBase64) {
        return NextResponse.json({ error: "图片服务未返回可用结果" }, { status: 502 });
      }

      const modelUsed = getString(payload?.model_used) || getString(payload?.modelUsed) || getString(payload?.model);

      return NextResponse.json({
        imageUrl,
        imageBase64,
        imageDataUrl: imageBase64 ? `data:image/png;base64,${imageBase64}` : "",
        modelUsed,
      });
    }

    if (lastAuthStatus) {
      return NextResponse.json(
        { error: `${lastAuthMessage}，请检查 INTERNAL_JWT_SECRET / INTERNAL_JWT_ISSUER / INTERNAL_JWT_AUDIENCE 是否与 Gemini 服务一致` },
        { status: lastAuthStatus },
      );
    }

    return NextResponse.json({ error: "调用 Gemini 风格预览服务失败（内部鉴权）" }, { status: 502 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? `调用 Gemini 风格预览服务失败：${error.message}` : "调用 Gemini 风格预览服务失败",
      },
      { status: 502 },
    );
  }
}
