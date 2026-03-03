import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { updateWorkspaceShot } from "@/lib/studio-api";

export async function PATCH(request: Request, context: { params: Promise<{ shotID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { shotID } = await context.params;

  const body = (await request.json().catch(() => null)) as
    | {
        seqNo?: number;
        voiceRole?: string;
        voiceLine?: string;
        sfxHint?: string;
        visualSpec?: Record<string, unknown>;
        finalAssetId?: string;
        status?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  try {
    const payload = await updateWorkspaceShot({
      accessToken: session.accessToken,
      shotId: shotID,
      seqNo: body.seqNo,
      voiceRole: body.voiceRole,
      voiceLine: body.voiceLine,
      sfxHint: body.sfxHint,
      visualSpec: body.visualSpec,
      finalAssetId: body.finalAssetId,
      status: body.status,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update shot" },
      { status: 400 },
    );
  }
}
