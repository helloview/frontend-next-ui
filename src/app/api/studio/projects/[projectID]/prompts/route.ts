import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createWorkspacePromptTemplate, listWorkspacePromptTemplates } from "@/lib/studio-api";

export async function GET(_: Request, context: { params: Promise<{ projectID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectID } = await context.params;

  try {
    const payload = await listWorkspacePromptTemplates({
      accessToken: session.accessToken,
      projectId: projectID,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list prompt templates" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectID } = await context.params;

  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        content?: string;
        tags?: string[];
      }
    | null;

  if (!body?.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const payload = await createWorkspacePromptTemplate({
      accessToken: session.accessToken,
      projectId: projectID,
      title: body.title,
      content: body.content,
      tags: body.tags,
    });
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create prompt template" },
      { status: 400 },
    );
  }
}
