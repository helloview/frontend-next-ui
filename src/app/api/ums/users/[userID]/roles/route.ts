import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { normalizeRoleValue } from "@/lib/role-labels";
import { updateUserRoles } from "@/lib/user-api";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userID: string }> },
) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userID } = await params;

  const body = (await request.json().catch(() => null)) as { roles?: string[] } | null;
  if (!body || !Array.isArray(body.roles) || body.roles.length === 0) {
    return NextResponse.json({ error: "roles is required" }, { status: 400 });
  }

  const roles = Array.from(new Set(body.roles.map((role) => normalizeRoleValue(role))));
  if (roles.length === 0 || roles.some((role) => role !== "user" && role !== "admin")) {
    return NextResponse.json({ error: "roles must be user or admin" }, { status: 400 });
  }

  try {
    const response = await updateUserRoles(session.accessToken, userID, roles);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update roles" },
      { status: 400 },
    );
  }
}
