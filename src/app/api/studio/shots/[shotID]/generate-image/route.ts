import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createWorkspaceImageJob } from "@/lib/studio-api";

export async function POST(request: Request, context: { params: Promise<{ shotID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { shotID } = await context.params;

  const body = (await request.json().catch(() => null)) as
    | {
        prompt?: string;
        negativePrompt?: string;
        width?: number;
        height?: number;
        seed?: number;
      }
    | null;

  try {
    const payload = await createWorkspaceImageJob({
      accessToken: session.accessToken,
      shotId: shotID,
      prompt: body?.prompt,
      negativePrompt: body?.negativePrompt,
      width: body?.width,
      height: body?.height,
      seed: body?.seed,
    });
    return NextResponse.json(payload, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create image job" },
      { status: 400 },
    );
  }
}
