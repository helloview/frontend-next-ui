import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getServerR2ServiceApiBaseUrl } from "@/lib/env";
import { createInternalServiceTokenCandidates, inferInternalServiceRole } from "@/lib/internal-service-auth";

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  const direct = getString(record.error) || getString(record.message) || getString(record.detail);
  if (direct) {
    return direct;
  }
  return "";
}

function sanitizeFileName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "仅支持图片文件" }, { status: 400 });
  }

  const maxUploadSizeMB = Number.parseInt(process.env.R2_MAX_UPLOAD_SIZE_MB || "64", 10);
  const maxUploadSizeBytes = (Number.isFinite(maxUploadSizeMB) && maxUploadSizeMB > 0 ? maxUploadSizeMB : 64) * 1024 * 1024;
  if (file.size > maxUploadSizeBytes) {
    return NextResponse.json(
      { error: `文件过大，当前上传上限为 ${Math.floor(maxUploadSizeBytes / 1024 / 1024)}MB` },
      { status: 413 },
    );
  }

  const styleID = getString(form.get("styleId"));
  const fileName = sanitizeFileName(file.name || `style-preview-${Date.now()}.png`) || `style-preview-${Date.now()}.png`;
  const subject = session.user.id || session.user.email || "studio-user";
  const objectKey = `style-previews/${styleID || subject}/${Date.now()}-${randomUUID()}-${fileName}`;

  const metadata = {
    source: "library-style-preview-upload",
    styleId: styleID,
    uploadedBy: subject,
  };

  const role = inferInternalServiceRole(session.user.roles ?? []);
  const tokens = createInternalServiceTokenCandidates({ subject, role });
  const endpoint = `${getServerR2ServiceApiBaseUrl().replace(/\/$/, "")}/api/v1/objects`;

  try {
    let lastAuthStatus = 0;
    let lastAuthMessage = "";

    for (const token of tokens) {
      const uploadForm = new FormData();
      uploadForm.append("file", file, file.name || fileName);
      uploadForm.append("key", objectKey);
      uploadForm.append("content_type", file.type || "image/png");
      uploadForm.append("metadata", JSON.stringify(metadata));

      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: uploadForm,
        cache: "no-store",
        signal: AbortSignal.timeout(120_000),
      });

      const payload = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
      if (!upstream.ok) {
        if (upstream.status === 413) {
          return NextResponse.json(
            { error: `文件过大，当前上传上限为 ${Math.floor(maxUploadSizeBytes / 1024 / 1024)}MB` },
            { status: 413 },
          );
        }
        const message = extractErrorMessage(payload) || `Request failed (${upstream.status})`;
        if (upstream.status === 401 || upstream.status === 403) {
          lastAuthStatus = upstream.status;
          lastAuthMessage = message;
          continue;
        }
        return NextResponse.json({ error: message }, { status: upstream.status });
      }

      const url = getString(payload?.url);
      const key = getString(payload?.key);
      if (!url) {
        return NextResponse.json({ error: "R2 未返回可用 URL" }, { status: 502 });
      }

      return NextResponse.json({
        url,
        key,
        bucket: getString(payload?.bucket),
        contentType: getString(payload?.content_type) || file.type,
      });
    }

    if (lastAuthStatus) {
      return NextResponse.json(
        { error: `${lastAuthMessage}，请检查 INTERNAL_JWT_SECRET / INTERNAL_JWT_ISSUER / INTERNAL_JWT_AUDIENCE 是否与 R2 服务一致` },
        { status: lastAuthStatus },
      );
    }

    return NextResponse.json({ error: "调用 R2 上传服务失败（内部鉴权）" }, { status: 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json(
      {
        error: `调用 R2 上传服务失败：${message}（endpoint: ${endpoint}）`,
      },
      { status: 502 },
    );
  }
}
