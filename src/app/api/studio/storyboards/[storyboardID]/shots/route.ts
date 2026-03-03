import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { listWorkspaceShots } from "@/lib/studio-api";

export async function GET(_: Request, context: { params: Promise<{ storyboardID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storyboardID } = await context.params;

  try {
    const payload = await listWorkspaceShots({
      accessToken: session.accessToken,
      storyboardId: storyboardID,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list shots" },
      { status: 400 },
    );
  }
}
