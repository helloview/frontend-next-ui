import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getServerChatboxApiBaseUrl } from "@/lib/env";
import { createInternalServiceTokenCandidates, inferInternalServiceRole } from "@/lib/internal-service-auth";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProvider(value: unknown): "gemini" | "ollama" {
  return value === "ollama" ? "ollama" : "gemini";
}

function normalizeContentType(value: unknown): "text" | "image" {
  return value === "image" ? "image" : "text";
}

type RouteContext = {
  params: Promise<{ conversationID: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationID } = await context.params;
  if (!conversationID || Number.isNaN(Number(conversationID))) {
    return NextResponse.json({ error: "invalid conversationID" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        content?: string;
        provider?: string;
        model?: string;
        content_type?: string;
        type?: string;
      }
    | null;

  const subject = session.user.id || session.user.email || "chatbox-user";
  const role = inferInternalServiceRole(session.user.roles);
  const tokens = createInternalServiceTokenCandidates({ subject, role });

  const endpoint = `${getServerChatboxApiBaseUrl().replace(/\/$/, "")}/v1/conversations/${conversationID}/messages/stream`;
  const upstreamBody = {
    content: getString(body?.content),
    provider: normalizeProvider(body?.provider),
    model: getString(body?.model),
    content_type: normalizeContentType(body?.content_type ?? body?.type),
  };

  let authFailureMessage = "";

  for (const token of tokens) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(upstreamBody),
        cache: "no-store",
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? `无法连接 Chatbox 服务：${error.message}` : "无法连接 Chatbox 服务" },
        { status: 502 },
      );
    }

    if (response.ok) {
      if (!response.body) {
        return NextResponse.json({ error: "Chatbox 流式响应为空" }, { status: 502 });
      }

      return new NextResponse(response.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const payload = (await response.json().catch(() => null)) as { error?: string; details?: string } | null;
    const errorMessage = getString(payload?.error) || getString(payload?.details) || `Chatbox 请求失败 (${response.status})`;

    if (response.status === 401 || response.status === 403) {
      authFailureMessage = errorMessage;
      continue;
    }

    return NextResponse.json({ error: errorMessage }, { status: response.status });
  }

  return NextResponse.json(
    {
      error: authFailureMessage
        ? `${authFailureMessage}，请检查 INTERNAL_JWT_SECRET / INTERNAL_JWT_ISSUER / INTERNAL_JWT_AUDIENCE`
        : "Chatbox 服务调用失败（内部鉴权）",
    },
    { status: 502 },
  );
}
