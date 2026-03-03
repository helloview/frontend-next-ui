import { NextResponse } from "next/server";

import { ApiRequestError } from "@/lib/api/client";
import { withStudioAccessToken } from "@/lib/studio-route-auth";
import { getWorkspaceProjectLibrary } from "@/lib/studio-api";

export async function GET(_: Request, context: { params: Promise<{ projectID: string }> }) {
  const { projectID } = await context.params;

  try {
    const payload = await withStudioAccessToken((accessToken) =>
      getWorkspaceProjectLibrary({
        accessToken,
        projectId: projectID,
      }),
    );
    return NextResponse.json(payload);
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load project library" },
      { status },
    );
  }
}
