import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { requestChatboxService } from "@/lib/chatbox-service";
import type { ChatboxContentType, ChatboxConversation, ChatboxProvider } from "@/types/chatbox";

function normalizeProvider(value: unknown): ChatboxProvider {
  return value === "ollama" ? "ollama" : "gemini";
}

function normalizeContentType(value: unknown): ChatboxContentType {
  return value === "image" ? "image" : "text";
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

type RouteContext = {
  params: Promise<{ conversationID: string }>;
};

function userInput(session: { user: { id: string; email?: string | null; roles?: string[] } }) {
  return {
    id: session.user.id,
    email: session.user.email,
    roles: session.user.roles,
  };
}

export async function PATCH(request: Request, context: RouteContext) {
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
        title?: string;
        provider?: string;
        model?: string;
        content_type?: string;
        type?: string;
      }
    | null;

  const result = await requestChatboxService<ChatboxConversation>({
    user: userInput(session),
    path: `/v1/conversations/${conversationID}`,
    method: "PATCH",
    body: {
      ...(body?.title !== undefined ? { title: getString(body.title) } : {}),
      ...(body?.provider !== undefined ? { provider: normalizeProvider(body.provider) } : {}),
      ...(body?.model !== undefined ? { model: getString(body.model) } : {}),
      ...(body?.content_type !== undefined || body?.type !== undefined
        ? { content_type: normalizeContentType(body?.content_type ?? body?.type) }
        : {}),
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.payload, { status: result.status });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationID } = await context.params;
  if (!conversationID || Number.isNaN(Number(conversationID))) {
    return NextResponse.json({ error: "invalid conversationID" }, { status: 400 });
  }

  const result = await requestChatboxService<void>({
    user: userInput(session),
    path: `/v1/conversations/${conversationID}`,
    method: "DELETE",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new NextResponse(null, { status: 204 });
}
