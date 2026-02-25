import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { reopenTodoItem } from "@/lib/todo-api";

type Params = {
  params: Promise<{
    itemID: string;
  }>;
};

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { itemID } = await params;
  if (!itemID) {
    return NextResponse.json({ error: "Missing itemID" }, { status: 400 });
  }

  try {
    const item = await reopenTodoItem({ accessToken: session.accessToken, itemID });
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reopen todo item" },
      { status: 400 },
    );
  }
}
