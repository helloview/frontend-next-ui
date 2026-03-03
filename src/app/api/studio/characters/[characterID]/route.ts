import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { updateWorkspaceCharacter } from "@/lib/studio-api";

export async function PATCH(request: Request, context: { params: Promise<{ characterID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { characterID } = await context.params;

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        title?: string;
        visualSpec?: Record<string, unknown>;
        primaryAssetId?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  try {
    const payload = await updateWorkspaceCharacter({
      accessToken: session.accessToken,
      characterId: characterID,
      name: body.name,
      title: body.title,
      visualSpec: body.visualSpec,
      primaryAssetId: body.primaryAssetId,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update character" },
      { status: 400 },
    );
  }
}
