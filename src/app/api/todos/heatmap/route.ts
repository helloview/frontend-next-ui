import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getTodoHeatmap } from "@/lib/todo-api";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? undefined;

  try {
    const heatmap = await getTodoHeatmap({ accessToken: session.accessToken, month });
    return NextResponse.json(heatmap);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load heatmap" },
      { status: 400 },
    );
  }
}
