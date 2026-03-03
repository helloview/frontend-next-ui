import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { updateWorkspaceEnvironment } from "@/lib/studio-api";

export async function PATCH(request: Request, context: { params: Promise<{ environmentID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { environmentID } = await context.params;

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        visualSpec?: Record<string, unknown>;
        primaryAssetId?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  try {
    const payload = await updateWorkspaceEnvironment({
      accessToken: session.accessToken,
      environmentId: environmentID,
      name: body.name,
      visualSpec: body.visualSpec,
      primaryAssetId: body.primaryAssetId,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update environment" },
      { status: 400 },
    );
  }
}
