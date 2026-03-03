import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createWorkspaceCharacter, listWorkspaceCharacters } from "@/lib/studio-api";

export async function GET(_: Request, context: { params: Promise<{ projectID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectID } = await context.params;

  try {
    const payload = await listWorkspaceCharacters({
      accessToken: session.accessToken,
      projectId: projectID,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list characters" },
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
        name?: string;
        title?: string;
        visualSpec?: Record<string, unknown>;
        primaryAssetId?: string;
      }
    | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const payload = await createWorkspaceCharacter({
      accessToken: session.accessToken,
      projectId: projectID,
      name: body.name,
      title: body.title,
      visualSpec: body.visualSpec,
      primaryAssetId: body.primaryAssetId,
    });
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create character" },
      { status: 400 },
    );
  }
}
