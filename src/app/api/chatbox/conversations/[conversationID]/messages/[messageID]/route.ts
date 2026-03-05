import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { requestChatboxService } from "@/lib/chatbox-service";

type RouteContext = {
  params: Promise<{ conversationID: string; messageID: string }>;
};

function userInput(session: { user: { id: string; email?: string | null; roles?: string[] } }) {
  return {
    id: session.user.id,
    email: session.user.email,
    roles: session.user.roles,
  };
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationID, messageID } = await context.params;
  if (!conversationID || Number.isNaN(Number(conversationID))) {
    return NextResponse.json({ error: "invalid conversationID" }, { status: 400 });
  }
  if (!messageID || Number.isNaN(Number(messageID))) {
    return NextResponse.json({ error: "invalid messageID" }, { status: 400 });
  }

  const result = await requestChatboxService<null>({
    user: userInput(session),
    path: `/v1/conversations/${conversationID}/messages/${messageID}`,
    method: "DELETE",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new NextResponse(null, { status: 204 });
}
