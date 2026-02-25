import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { deleteTodoItem, updateTodoItem } from "@/lib/todo-api";

type Params = {
  params: Promise<{
    itemID: string;
  }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemID } = await params;
  if (!itemID) {
    return NextResponse.json({ error: "Missing itemID" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        title?: string;
        note?: string;
        priority?: number;
        startAt?: string | null;
        dueAt?: string | null;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const item = await updateTodoItem({
      accessToken: session.accessToken,
      itemID,
      title: body.title,
      note: body.note,
      priority: body.priority,
      startAt: body.startAt,
      dueAt: body.dueAt,
    });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update todo item" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemID } = await params;
  if (!itemID) {
    return NextResponse.json({ error: "Missing itemID" }, { status: 400 });
  }

  try {
    await deleteTodoItem({ accessToken: session.accessToken, itemID });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete todo item" },
      { status: 400 },
    );
  }
}
