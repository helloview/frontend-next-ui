import { NextResponse } from "next/server";

import { ApiRequestError } from "@/lib/api/client";
import { withStudioAccessToken } from "@/lib/studio-route-auth";
import { createWorkspaceProject, listWorkspaceProjects } from "@/lib/studio-api";
import type { WorkspaceVisibility } from "@/types/studio";

export async function GET() {
  try {
    const payload = await withStudioAccessToken((accessToken) =>
      listWorkspaceProjects({ accessToken }),
    );
    return NextResponse.json(payload);
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list workspace projects" },
      { status },
    );
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        title?: string;
        description?: string;
        tags?: string[];
        visibility?: WorkspaceVisibility;
      }
    | null;
  const payload = body ?? {};

  const name = payload.name ?? payload.title ?? "";
  if (!name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const project = await withStudioAccessToken((accessToken) =>
      createWorkspaceProject({
        accessToken,
        name,
        description: payload.description,
        tags: payload.tags,
        visibility: payload.visibility,
      }),
    );
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create workspace project" },
      { status },
    );
  }
}
