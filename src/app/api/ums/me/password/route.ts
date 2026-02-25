import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getServerUmsApiBaseUrl } from "@/lib/env";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        current_password?: string;
        new_password?: string;
      }
    | null;

  if (!body?.current_password || !body?.new_password) {
    return NextResponse.json({ error: "current_password and new_password are required" }, { status: 400 });
  }

  try {
    const upstream = await fetch(`${getServerUmsApiBaseUrl()}/v1/users/me/password`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        current_password: body.current_password,
        new_password: body.new_password,
      }),
      cache: "no-store",
    });

    const payload = (await upstream.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!upstream.ok) {
      return NextResponse.json(
        { error: payload?.error ?? `Failed to change password (${upstream.status})` },
        { status: upstream.status },
      );
    }

    return NextResponse.json(payload ?? { message: "password updated" }, { status: upstream.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to change password" },
      { status: 502 },
    );
  }
}
