import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getWorkspaceJob } from "@/lib/studio-api";

export async function GET(_: Request, context: { params: Promise<{ jobID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobID } = await context.params;

  try {
    const payload = await getWorkspaceJob({
      accessToken: session.accessToken,
      jobId: jobID,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load job" },
      { status: 400 },
    );
  }
}
