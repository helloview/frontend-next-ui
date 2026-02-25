import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getTodoSummary } from "@/lib/todo-api";

export async function GET() {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await getTodoSummary({ accessToken: session.accessToken });
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load summary" },
      { status: 400 },
    );
  }
}
