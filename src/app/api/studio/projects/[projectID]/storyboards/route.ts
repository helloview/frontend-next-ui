import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createWorkspaceStoryboard, listWorkspaceStoryboards } from "@/lib/studio-api";

export async function GET(_: Request, context: { params: Promise<{ projectID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectID } = await context.params;

  try {
    const payload = await listWorkspaceStoryboards({
      accessToken: session.accessToken,
      projectId: projectID,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list storyboards" },
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
        stylePresetId?: string;
        status?: string;
        shots?: Array<{
          seqNo?: number;
          voiceRole?: string;
          voiceLine?: string;
          sfxHint?: string;
          visualSpec?: Record<string, unknown>;
          status?: string;
        }>;
      }
    | null;

  try {
    const payload = await createWorkspaceStoryboard({
      accessToken: session.accessToken,
      projectId: projectID,
      title: body?.title,
      stylePresetId: body?.stylePresetId,
      status: body?.status,
      shots: body?.shots,
    });
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create storyboard" },
      { status: 400 },
    );
  }
}
