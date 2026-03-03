import { NextResponse } from "next/server";

import { ApiRequestError } from "@/lib/api/client";
import { withStudioAccessToken } from "@/lib/studio-route-auth";
import { deleteWorkspaceProject, getWorkspaceProject, updateWorkspaceProject } from "@/lib/studio-api";
import type { WorkspaceVisibility } from "@/types/studio";

export async function GET(_: Request, context: { params: Promise<{ projectID: string }> }) {
  const { projectID } = await context.params;

  try {
    const bundle = await withStudioAccessToken((accessToken) =>
      getWorkspaceProject({ accessToken, projectId: projectID }),
    );
    return NextResponse.json(bundle);
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load project" },
      { status },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ projectID: string }> }) {
  const { projectID } = await context.params;

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        title?: string;
        description?: string;
        tags?: string[];
        visibility?: WorkspaceVisibility;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  try {
    const bundle = await withStudioAccessToken((accessToken) =>
      updateWorkspaceProject({
        accessToken,
        projectId: projectID,
        name: body.name ?? body.title,
        description: body.description,
        tags: body.tags,
        visibility: body.visibility,
      }),
    );
    return NextResponse.json(bundle);
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update project" },
      { status },
    );
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ projectID: string }> }) {
  const { projectID } = await context.params;

  try {
    await withStudioAccessToken((accessToken) =>
      deleteWorkspaceProject({ accessToken, projectId: projectID }),
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const status = error instanceof ApiRequestError ? error.status : 502;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete project" },
      { status },
    );
  }
}
