import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { requestChatboxService } from "@/lib/chatbox-service";
import type { ChatboxModelsResponse } from "@/types/chatbox";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await requestChatboxService<ChatboxModelsResponse>({
    user: {
      id: session.user.id,
      email: session.user.email,
      roles: session.user.roles,
    },
    path: "/v1/models",
    method: "GET",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.payload, { status: result.status });
}
