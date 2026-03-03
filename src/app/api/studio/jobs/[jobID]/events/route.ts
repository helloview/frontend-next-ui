import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { listWorkspaceJobEvents } from "@/lib/studio-api";

export async function GET(request: Request, context: { params: Promise<{ jobID: string }> }) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobID } = await context.params;
  const url = new URL(request.url);
  const afterRaw = url.searchParams.get("after");
  const limitRaw = url.searchParams.get("limit");

  const after = afterRaw ? Number(afterRaw) : undefined;
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const payload = await listWorkspaceJobEvents({
      accessToken: session.accessToken,
      jobId: jobID,
      after: Number.isFinite(after as number) ? (after as number) : undefined,
      limit: Number.isFinite(limit as number) ? (limit as number) : undefined,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list job events" },
      { status: 400 },
    );
  }
}
