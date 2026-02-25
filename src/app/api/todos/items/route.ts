import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createTodoItem, listTodoItems } from "@/lib/todo-api";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const days = searchParams.get("days");
  const limit = searchParams.get("limit");
  const offset = searchParams.get("offset");

  try {
    const payload = await listTodoItems({
      accessToken: session.accessToken,
      status: status === "open" || status === "done" ? status : undefined,
      days: days ? Number(days) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list todo items" },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        note?: string;
        priority?: number;
        startAt?: string;
        dueAt?: string;
      }
    | null;

  if (!body?.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    const item = await createTodoItem({
      accessToken: session.accessToken,
      title: body.title,
      note: body.note,
      priority: body.priority,
      startAt: body.startAt,
      dueAt: body.dueAt,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create todo item" },
      { status: 400 },
    );
  }
}
