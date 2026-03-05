import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { requestChatboxService } from "@/lib/chatbox-service";
import type { ChatboxConversation, ChatboxConversationListResponse, ChatboxContentType, ChatboxProvider } from "@/types/chatbox";

function normalizeProvider(value: unknown): ChatboxProvider {
  return value === "ollama" ? "ollama" : "gemini";
}

function normalizeContentType(value: unknown): ChatboxContentType {
  return value === "image" ? "image" : "text";
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function userInput(session: { user: { id: string; email?: string | null; roles?: string[] } }) {
  return {
    id: session.user.id,
    email: session.user.email,
    roles: session.user.roles,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await requestChatboxService<ChatboxConversationListResponse>({
    user: userInput(session),
    path: "/v1/conversations",
    method: "GET",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.payload, { status: result.status });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        provider?: string;
        model?: string;
        content_type?: string;
        type?: string;
      }
    | null;

  const result = await requestChatboxService<ChatboxConversation>({
    user: userInput(session),
    path: "/v1/conversations",
    method: "POST",
    body: {
      title: getString(body?.title),
      provider: normalizeProvider(body?.provider),
      model: getString(body?.model),
      content_type: normalizeContentType(body?.content_type ?? body?.type),
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.payload, { status: result.status });
}
