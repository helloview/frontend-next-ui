import { NextResponse } from "next/server";

import { auth } from "@/auth";

const MAX_PROXY_AUDIO_BYTES = 32 * 1024 * 1024;

function getErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const msg = record.error ?? record.message ?? record.detail;
  return typeof msg === "string" ? msg : "";
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sourceUrl = searchParams.get("url")?.trim() || "";
  if (!sourceUrl) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(sourceUrl);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "unsupported protocol" }, { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
    });

    if (!upstream.ok) {
      const payload = (await upstream.json().catch(() => null)) as unknown;
      const reason = getErrorMessage(payload) || `upstream request failed (${upstream.status})`;
      return NextResponse.json({ error: reason }, { status: upstream.status });
    }

    const sizeHeader = upstream.headers.get("content-length");
    if (sizeHeader) {
      const length = Number.parseInt(sizeHeader, 10);
      if (Number.isFinite(length) && length > MAX_PROXY_AUDIO_BYTES) {
        return NextResponse.json({ error: "audio file too large for waveform analysis" }, { status: 413 });
      }
    }

    const contentType = upstream.headers.get("content-type") || "audio/mpeg";
    const headers = new Headers();
    headers.set("content-type", contentType);
    headers.set("cache-control", "private, max-age=600");
    headers.set("x-waveform-audio-proxy", "1");

    if (sizeHeader) {
      headers.set("content-length", sizeHeader);
    }

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "proxy failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

