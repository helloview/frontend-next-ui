import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { deleteWorkspaceVoicePreset, updateWorkspaceVoicePreset } from "@/lib/studio-api";

export async function PATCH(request: Request, context: { params: Promise<{ voiceID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { voiceID } = await context.params;

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        provider?: string;
        voiceId?: string;
        config?: Record<string, unknown>;
        previewText?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  try {
    const payload = await updateWorkspaceVoicePreset({
      accessToken: session.accessToken,
      voicePresetId: voiceID,
      name: body.name,
      provider: body.provider,
      voiceId: body.voiceId,
      config: body.config,
      previewText: body.previewText,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update voice preset" },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ voiceID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { voiceID } = await context.params;

  try {
    await deleteWorkspaceVoicePreset({
      accessToken: session.accessToken,
      voicePresetId: voiceID,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete voice preset" },
      { status: 400 },
    );
  }
}
