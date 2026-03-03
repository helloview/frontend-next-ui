import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { deleteWorkspaceStylePreset, updateWorkspaceStylePreset } from "@/lib/studio-api";

export async function PATCH(request: Request, context: { params: Promise<{ styleID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { styleID } = await context.params;

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        spec?: Record<string, unknown>;
        isDefault?: boolean;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  try {
    const payload = await updateWorkspaceStylePreset({
      accessToken: session.accessToken,
      styleId: styleID,
      name: body.name,
      spec: body.spec,
      isDefault: body.isDefault,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update style preset" },
      { status: 400 },
    );
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ styleID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { styleID } = await context.params;

  try {
    await deleteWorkspaceStylePreset({
      accessToken: session.accessToken,
      styleId: styleID,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete style preset" },
      { status: 400 },
    );
  }
}
