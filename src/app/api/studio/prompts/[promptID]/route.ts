import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { deleteWorkspacePromptTemplate, updateWorkspacePromptTemplate } from "@/lib/studio-api";

export async function PATCH(request: Request, context: { params: Promise<{ promptID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { promptID } = await context.params;

  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        content?: string;
        previewResult?: string;
        tags?: string[];
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  try {
    const payload = await updateWorkspacePromptTemplate({
      accessToken: session.accessToken,
      promptId: promptID,
      title: body.title,
      content: body.content,
      previewResult: body.previewResult,
      tags: body.tags,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update prompt template" },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ promptID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { promptID } = await context.params;

  try {
    await deleteWorkspacePromptTemplate({
      accessToken: session.accessToken,
      promptId: promptID,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete prompt template" },
      { status: 400 },
    );
  }
}
