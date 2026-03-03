import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createWorkspaceVoicePreset, listWorkspaceVoicePresets } from "@/lib/studio-api";

export async function GET(_: Request, context: { params: Promise<{ projectID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectID } = await context.params;

  try {
    const payload = await listWorkspaceVoicePresets({
      accessToken: session.accessToken,
      projectId: projectID,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list voice presets" },
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
        provider?: string;
        voiceId?: string;
        config?: Record<string, unknown>;
        previewText?: string;
      }
    | null;

  if (!body?.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!body?.voiceId?.trim()) {
    return NextResponse.json({ error: "voiceId is required" }, { status: 400 });
  }

  try {
    const payload = await createWorkspaceVoicePreset({
      accessToken: session.accessToken,
      projectId: projectID,
      name: body.name,
      provider: body.provider,
      voiceId: body.voiceId,
      config: body.config,
      previewText: body.previewText,
    });
    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create voice preset" },
      { status: 400 },
    );
  }
}
