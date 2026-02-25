import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { listUsers } from "@/lib/user-api";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await listUsers(session.accessToken);
    return NextResponse.json(users);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list users" },
      { status: 400 },
    );
  }
}
