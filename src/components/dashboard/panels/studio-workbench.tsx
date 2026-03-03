"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Users,
  Mic,
  Palette,
  Film,
  ChevronRight,
  RefreshCw,
  Trash2,
  Loader2,
  Save,
  FileTerminal,
  LayoutDashboard,
  Search,
  Clock,
  LayoutList,
  Check,
  CheckCircle,
  Download,
  Sparkles,
  CheckCircle2,
  Settings,
  AlertCircle,
  Eye,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import type {
  PipelineStepID,
  ProjectCardModel,
  WorkspaceCharacter,
  WorkspaceEnvironment,
  WorkspaceProject,
  WorkspaceProjectDetail,
  WorkspaceProjectLibrary,
  WorkspaceShot,
  WorkspaceShotsResponse,
  WorkspaceStoryboard,
  WorkspaceStoryboardsResponse,
  WorkspaceVisibility,
  WorkspacePromptTemplate,
  WorkspaceStylePreset,
  WorkspaceVoicePreset,
} from "@/types/studio";

function ProjectSettingsModal({
  project,
  onClose,
  onUpdate,
}: {
  project: WorkspaceProject;
  onClose: () => void;
  onUpdate: (data: Partial<WorkspaceProject>) => Promise<void>;
}) {
  const [name, setName] = useState(project.name);
  const [visibility, setVisibility] = useState<WorkspaceVisibility>(project.visibility || "private");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({ name, visibility });
      toast.success("项目设置已更新");
      onClose();
    } catch {
      toast.error("更新失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/35 p-0 backdrop-blur-[2px] animate-in fade-in sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 animate-in zoom-in-95 duration-200 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-8 sm:py-6">
          <div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">项目设置</h3>
            <p className="mt-1 text-xs font-medium text-zinc-500">修改项目的基础信息与可见权限。</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-900">
            <Plus size={24} className="rotate-45" />
          </button>
        </div>
        <div className="custom-scrollbar flex-1 min-h-0 space-y-6 overflow-y-auto px-4 py-5 sm:space-y-8 sm:px-8 sm:py-8">
          <FormInput label="项目名称" value={name} onChange={setName} placeholder="请输入项目名称" />
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">可见性设置</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as WorkspaceVisibility)}
              className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold outline-none focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              <option value="private">仅自己可见（私有）</option>
              <option value="public">所有成员可见（公开）</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:px-8 sm:py-5">
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-zinc-200 py-3 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 sm:flex-1"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (name === project.name && visibility === project.visibility)}
            className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-rose-500 sm:flex-[1.6]"
          >
            {saving ? <Loader2 size={18} className="mx-auto animate-spin" /> : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 接口请求助手 ---

class RequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

const isNotFoundLike = (error: unknown) =>
  error instanceof RequestError &&
  (error.status === 404 || (error.status === 400 && /\b404\b/.test(error.message)));

const isForbiddenLike = (error: unknown) =>
  error instanceof RequestError &&
  (error.status === 403 || (error.status === 400 && /\b403\b/.test(error.message)));

const isServiceUnavailableLike = (error: unknown) =>
  error instanceof RequestError &&
  (error.status === 502 || error.status === 503 || /bad gateway|connection refused|connect|not found|no route/i.test(error.message));

const isUnauthorizedLike = (error: unknown) =>
  error instanceof RequestError &&
  (error.status === 401 || (error.status === 400 && /\b401\b|unauthorized/i.test(error.message)));

const fatalSessionErrors = new Set(["MissingRefreshToken", "RefreshTokenExpired"]);

type SessionProbe = {
  user?: unknown;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
};

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readSessionProbe(): Promise<SessionProbe | null> {
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return (await response.json().catch(() => null)) as SessionProbe | null;
  } catch {
    return null;
  }
}

async function recoverSessionAfterUnauthorized(): Promise<"retry" | "login" | "pending"> {
  const first = await readSessionProbe();
  if (!first?.user) {
    return "login";
  }
  if (fatalSessionErrors.has(first.error ?? "")) {
    return "login";
  }
  if (first.accessToken) {
    return "retry";
  }
  if (!first.refreshToken) {
    return "login";
  }

  await wait(220);
  const second = await readSessionProbe();
  if (!second?.user) {
    return "login";
  }
  if (fatalSessionErrors.has(second.error ?? "")) {
    return "login";
  }
  return second.accessToken ? "retry" : "pending";
}

async function shouldRedirectToLoginOnUnauthorized(): Promise<boolean> {
  const probe = await readSessionProbe();
  if (!probe?.user) {
    return true;
  }
  if (fatalSessionErrors.has(probe.error ?? "")) {
    return true;
  }
  if (probe.accessToken) {
    return false;
  }
  // Keep user in dashboard while refresh token still exists. Frontend can retry later.
  return !probe.refreshToken;
}

async function fetchJSON<T>(
  input: RequestInfo,
  init?: RequestInit,
  options?: { retryOnUnauthorized?: boolean; signal?: AbortSignal },
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: options?.signal,
  });
  const payload = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    const error = new RequestError(
      response.status,
      (payload as { error?: string } | null)?.error ?? `请求失败: ${response.status}`,
    );
    if ((options?.retryOnUnauthorized ?? true) && isUnauthorizedLike(error) && typeof window !== "undefined") {
      const recovered = await recoverSessionAfterUnauthorized();
      if (recovered === "retry") {
        return fetchJSON<T>(input, init, { retryOnUnauthorized: false });
      }
    }
    throw error;
  }
  return payload as T;
}

type WorkspaceOwnerProfile = {
  id: string;
  nickname: string;
  avatarSeed?: string;
  avatarBackground?: string;
};

type OwnerProfileMap = Record<string, WorkspaceOwnerProfile>;

function buildNotionistsAvatar(seed: string, backgroundColor = "f4f4f5") {
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${backgroundColor}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
}

function readTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string");
      }
    } catch {
      // fall through
    }
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeWorkspaceOwner(raw: unknown, fallbackOwnerID: string): WorkspaceProject["owner"] | undefined {
  const record = asRecord(raw);
  if (!record) {
    return undefined;
  }
  const id = readString(record, ["id", "ownerId", "owner_id"]) || fallbackOwnerID;
  const nickname = readString(record, ["nickname", "displayName", "display_name", "displayNickname", "owner_nickname"]);
  if (!id || !nickname || nickname === "未知成员") {
    return undefined;
  }
  const avatarSeed = readString(record, ["avatarSeed", "avatar_seed", "owner_avatar_seed"]);
  const avatarBackground = readString(record, ["avatarBackground", "avatar_background", "owner_avatar_background"]);
  return {
    id,
    nickname,
    avatarSeed: avatarSeed || undefined,
    avatarBackground: avatarBackground || undefined,
  };
}

function normalizeWorkspaceProject(raw: unknown): WorkspaceProject | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const id = readString(record, ["id"]);
  if (!id) {
    return null;
  }

  const ownerId = readString(record, ["ownerId", "owner_id", "userId", "user_id"]) || "unknown-owner";
  const name = readString(record, ["name", "title"]) || "未命名项目";
  const description = readString(record, ["description"]) || "";
  const visibilityRaw = (readString(record, ["visibility"]) || "private").toLowerCase();
  const visibility: WorkspaceVisibility = visibilityRaw === "public" ? "public" : "private";
  const createdAt = readString(record, ["createdAt", "created_at"]) || new Date().toISOString();
  const updatedAt = readString(record, ["updatedAt", "updated_at"]) || createdAt;
  const tags = readTags(record.tags);
  const owner = normalizeWorkspaceOwner(record.owner, ownerId);

  return {
    id,
    ownerId,
    owner,
    name,
    description,
    tags,
    visibility,
    createdAt,
    updatedAt,
  };
}

function extractWorkspaceProjects(payload: unknown): WorkspaceProject[] {
  const root = asRecord(payload);
  const data = root ? asRecord(root.data) : null;

  let itemsRaw: unknown[] = [];
  if (Array.isArray(payload)) {
    itemsRaw = payload;
  } else if (Array.isArray(root?.items)) {
    itemsRaw = root.items as unknown[];
  } else if (Array.isArray(data?.items)) {
    itemsRaw = data.items as unknown[];
  }

  return itemsRaw
    .map((item) => normalizeWorkspaceProject(item))
    .filter((item): item is WorkspaceProject => item !== null);
}

function resolveOwnerProfile(
  ownerID: string,
  currentUser: WorkspaceOwnerProfile,
  ownerProfiles: OwnerProfileMap,
  projectOwner?: { nickname: string; avatarSeed?: string; avatarBackground?: string },
): WorkspaceOwnerProfile {
  if (ownerID === currentUser.id) {
    return currentUser;
  }
  const matched = ownerProfiles[ownerID];
  if (matched) {
    return matched;
  }
  if (projectOwner && projectOwner.nickname && projectOwner.nickname !== "未知成员") {
    return {
      id: ownerID,
      nickname: projectOwner.nickname,
      avatarSeed: projectOwner.avatarSeed || `${ownerID}-core`,
      avatarBackground: projectOwner.avatarBackground || "f4f4f5",
    };
  }
  return {
    id: ownerID,
    nickname: "未知成员",
    avatarSeed: `${ownerID}-core`,
    avatarBackground: "f4f4f5",
  };
}

const COMPLETED_STORYBOARD_STATUSES = new Set(["done", "completed", "published", "ready", "approved", "succeeded"]);
const APPROVED_SHOT_STATUSES = new Set(["approved", "done", "completed", "published", "ready", "succeeded"]);
const SYSTEM_LIBRARY_TAG = "__system_global_library__";
const SYSTEM_LIBRARY_NAME = "团队全局资料库";
const PROJECT_STYLE_TAG_PREFIX = "__project_style__:";

function isShotApprovedStatus(status: string): boolean {
  return APPROVED_SHOT_STATUSES.has((status || "").trim().toLowerCase());
}

function sortStoryboards(items: WorkspaceStoryboard[]): WorkspaceStoryboard[] {
  return [...items].sort((left, right) => {
    if ((left.version || 0) !== (right.version || 0)) {
      return (right.version || 0) - (left.version || 0);
    }
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

function readSelectedStyleIdFromTags(tags: string[] = []): string {
  const matched = tags.find((tag) => typeof tag === "string" && tag.startsWith(PROJECT_STYLE_TAG_PREFIX));
  return matched ? matched.slice(PROJECT_STYLE_TAG_PREFIX.length).trim() : "";
}

function withSelectedStyleTag(tags: string[] = [], styleId: string): string[] {
  const next = tags.filter((tag) => !tag.startsWith(PROJECT_STYLE_TAG_PREFIX));
  if (styleId.trim()) {
    next.push(`${PROJECT_STYLE_TAG_PREFIX}${styleId.trim()}`);
  }
  return next;
}

function formatUpdatedLabel(raw: string): string {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "刚刚更新";
  }
  const diff = Date.now() - parsed.getTime();
  if (diff < 60_000) {
    return "刚刚更新";
  }
  if (diff < 3_600_000) {
    return `${Math.max(1, Math.floor(diff / 60_000))} 分钟前`;
  }
  if (diff < 86_400_000) {
    return `${Math.max(1, Math.floor(diff / 3_600_000))} 小时前`;
  }
  if (diff < 604_800_000) {
    return `${Math.max(1, Math.floor(diff / 86_400_000))} 天前`;
  }
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function computeProjectSnapshot(
  project: WorkspaceProject,
  detail?: WorkspaceProjectDetail,
  library?: WorkspaceProjectLibrary,
): { progress: number; stage: string } {
  const description = typeof project.description === "string" ? project.description : "";
  const scriptReady = description.trim().length > 0;
  const styleReady =
    readSelectedStyleIdFromTags(project.tags || []).length > 0 ||
    (library?.styles?.length ?? 0) > 0;
  const worldviewReady =
    (detail?.characters?.length ?? 0) +
      (detail?.environments?.length ?? 0) +
      (library?.characters?.length ?? 0) +
      (library?.environments?.length ?? 0) >
    0;
  const audioReady = (library?.voices?.length ?? 0) > 0;
  const storyboardReady = (detail?.storyboards?.length ?? 0) > 0;
  const exportReady =
    detail?.storyboards?.some((storyboard) =>
      COMPLETED_STORYBOARD_STATUSES.has((storyboard.status ?? "").trim().toLowerCase()),
    ) ?? false;

  const steps = [scriptReady, styleReady, worldviewReady, audioReady, storyboardReady, exportReady];
  const completed = steps.filter(Boolean).length;
  const progress = Math.round((completed / steps.length) * 100);

  if (!scriptReady) return { progress, stage: "文案待开始" };
  if (!styleReady) return { progress, stage: "视觉风格" };
  if (!worldviewReady) return { progress, stage: "角色设定" };
  if (!audioReady) return { progress, stage: "音频配置" };
  if (!storyboardReady) return { progress, stage: "分镜制作" };
  if (!exportReady) return { progress, stage: "交付导出" };
  return { progress, stage: "已完成" };
}

function mapProjectCard(
  project: WorkspaceProject,
  currentUser: WorkspaceOwnerProfile,
  ownerProfiles: OwnerProfileMap,
  detail?: WorkspaceProjectDetail,
  library?: WorkspaceProjectLibrary,
): ProjectCardModel {
  const snapshot = computeProjectSnapshot(project, detail, library);
  const owner =
    project.owner && project.owner.nickname && project.owner.nickname !== "未知成员"
      ? {
          id: project.owner.id || project.ownerId,
          nickname: project.owner.nickname,
          avatarSeed: project.owner.avatarSeed,
          avatarBackground: project.owner.avatarBackground,
        }
      : resolveOwnerProfile(project.ownerId, currentUser, ownerProfiles);
  const ownerAvatar = buildNotionistsAvatar(owner.avatarSeed || `${owner.id}-core`, owner.avatarBackground || "f4f4f5");
  const statusLabel = snapshot.progress <= 0 ? "未开始" : snapshot.progress >= 100 ? "已完成" : "进行中";
  const normalizedVisibility: WorkspaceVisibility = project.visibility === "public" ? "public" : "private";
  const visibilityLabel = normalizedVisibility === "public" ? "所有成员可见" : "仅归属者可见";

  return {
    id: project.id,
    ownerId: project.ownerId,
    ownerAvatar,
    ownerLabel: (owner.nickname || "").trim() || "未知成员",
    title: typeof project.name === "string" && project.name.trim() ? project.name : "未命名项目",
    stage: snapshot.stage,
    statusLabel,
    progress: snapshot.progress,
    updated: formatUpdatedLabel(project.updatedAt),
    visibility: normalizedVisibility,
    visibilityLabel,
  };
}

const STYLE_META_KEYS = new Set([
  "previewImageUrl",
  "preview_image_url",
  "coverImageUrl",
  "imageUrl",
  "url",
  "preview",
  "previewSource",
  "previewPrompt",
  "previewUpdatedAt",
  "previewModel",
  "previewResult",
  "previewError",
]);

function filterInternalKeys(obj: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!obj) return null;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (STYLE_META_KEYS.has(key)) continue;
    next[key] = value;
  }
  return next;
}

function highlightJson(value: string): string {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped.replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?=\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (match.startsWith("\"") && match.endsWith("\"")) {
        if (/:$/.test(match)) {
          return `<span class="text-indigo-500 dark:text-indigo-400">${match}</span>`;
        }
        return `<span class="text-emerald-600 dark:text-emerald-400">${match}</span>`;
      }
      if (match === "true" || match === "false") {
        return `<span class="text-orange-500 dark:text-orange-400">${match}</span>`;
      }
      if (match === "null") {
        return `<span class="text-zinc-400 dark:text-zinc-500">${match}</span>`;
      }
      return `<span class="text-rose-500 dark:text-rose-400">${match}</span>`;
    },
  );
}

function JsonCodePreview({ value, className = "" }: { value: string; className?: string }) {
  const html = useMemo(() => highlightJson(value), [value]);

  return (
    <pre
      className={`overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-100 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const asText = (v: unknown) => (typeof v === "string" ? v : "");

function getStyleDescription(style: WorkspaceStylePreset): string {
  const spec = (style.spec ?? {}) as Record<string, unknown>;
  return (
    asText(spec.content) ||
    asText(spec.prompt) ||
    asText(spec.description) ||
    asText(spec.summary) ||
    ""
  );
}

function getStylePreviewUrl(style: WorkspaceStylePreset): string {
  const spec = (style.spec ?? {}) as Record<string, unknown>;
  const direct =
    asText(spec.previewImageUrl) ||
    asText(spec.preview_image_url) ||
    asText(spec.coverImageUrl) ||
    asText(spec.imageUrl) ||
    asText(spec.url);
  if (direct) {
    return direct;
  }
  const nestedPreview = asRecord(spec.preview);
  if (nestedPreview) {
    return (
      asText(nestedPreview.url) ||
      asText(nestedPreview.imageUrl) ||
      asText(nestedPreview.previewImageUrl) ||
      ""
    );
  }
  return "";
}

function mergeStylePresets(projectStyles: WorkspaceStylePreset[], globalStyles: WorkspaceStylePreset[]): WorkspaceStylePreset[] {
  const map = new Map<string, WorkspaceStylePreset>();
  for (const item of [...globalStyles, ...projectStyles]) {
    if (item?.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values()).sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
    return Number.isFinite(rightTime - leftTime) ? rightTime - leftTime : 0;
  });
}

// --- 常量定义 ---

const PIPELINE_STEPS: Array<{ id: PipelineStepID; label: string; icon: React.ElementType }> = [
  { id: "script", label: "剧本文稿", icon: FileTerminal },
  { id: "style", label: "视觉风格", icon: Palette },
  { id: "worldview", label: "人物与场景", icon: Users },
  { id: "audio", label: "剧本配音", icon: Mic },
  { id: "storyboard", label: "分镜审查", icon: LayoutList },
  { id: "export", label: "交付导出", icon: CheckCircle },
];

type ScriptGenerationProvider = "gemini" | "ollama";
type GeminiThinkingLevel = "minimal" | "low" | "medium" | "high";
type OllamaThinkMode = "none" | "boolean" | "string";

type ScriptProviderCatalog = {
  textModels: string[];
  imageModels: string[];
  defaultTextModel: string;
  defaultImageModel: string;
  thinking: {
    supportsLevel: boolean;
    levelOptions: string[];
    supportsBudget: boolean;
    supportsBoolean: boolean;
    supportsString: boolean;
    stringSuggestions: string[];
  };
};

type ScriptModelsResponse = {
  providers: {
    gemini: ScriptProviderCatalog;
    ollama: ScriptProviderCatalog;
  };
  warnings: string[];
  warningsByProvider?: Partial<Record<ScriptGenerationProvider, string>>;
};

type WorldviewDraftEntity = {
  name: string;
  title: string;
  visualSpec: Record<string, unknown>;
};

type ParsedWorldviewPayload = {
  characters: WorldviewDraftEntity[];
  environments: WorldviewDraftEntity[];
};

type WorldviewGenerationResponse = {
  provider: ScriptGenerationProvider;
  content: string;
  modelUsed?: string;
  thinking?: string;
};

type WorldviewViewerTarget =
  | { type: "characters"; item: WorkspaceCharacter }
  | { type: "environments"; item: WorkspaceEnvironment };

const WORLDVIEW_VISUAL_META_KEYS = new Set([
  "id",
  "name",
  "title",
  "image",
  "imageKey",
  "image_key",
  "images",
  "primaryAsset",
  "primaryAssetId",
  "primary_asset_id",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
]);

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  return trimmed;
}

function readArrayByKeys(record: Record<string, unknown> | null, keys: string[]): unknown[] {
  if (!record) {
    return [];
  }
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function sanitizeVisualSpec(record: Record<string, unknown>, parent?: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (WORLDVIEW_VISUAL_META_KEYS.has(key)) {
      continue;
    }
    next[key] = value;
  }
  if (parent) {
    if (typeof parent.image === "string" && !(typeof next.image === "string")) {
      next.image = parent.image;
    }
    if (typeof parent.imageKey === "string" && !(typeof next.imageKey === "string")) {
      next.imageKey = parent.imageKey;
    }
    if (typeof parent.image_key === "string" && !(typeof next.imageKey === "string")) {
      next.imageKey = parent.image_key;
    }
    if (Array.isArray(parent.images) && !Array.isArray(next.images)) {
      next.images = parent.images;
    }
  }
  return next;
}

function normalizeWorldviewEntity(raw: unknown): WorldviewDraftEntity | null {
  const record = asRecord(raw);
  if (!record) {
    return null;
  }

  const name = readString(record, ["name", "title", "名称", "角色名", "场景名"]).trim();
  if (!name) {
    return null;
  }
  const title = readString(record, ["title", "name", "名称"]).trim() || name;

  const visualNode =
    asRecord(record["视觉信息"]) ||
    asRecord(record.visualSpec) ||
    asRecord(record.visual_spec) ||
    asRecord(record.spec);

  let visualSpec = visualNode ? sanitizeVisualSpec(visualNode, record) : {};
  if (Object.keys(visualSpec).length === 0) {
    visualSpec = sanitizeVisualSpec(record);
  }

  return {
    name,
    title,
    visualSpec,
  };
}

function parseWorldviewPayload(raw: string): ParsedWorldviewPayload {
  const normalized = extractJsonPayload(raw);
  if (!normalized) {
    throw new Error("请先输入 JSON 内容");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    const startIndex = normalized.indexOf("{");
    const endIndex = normalized.lastIndexOf("}");
    if (startIndex >= 0 && endIndex > startIndex) {
      parsed = JSON.parse(normalized.slice(startIndex, endIndex + 1));
    } else {
      throw new Error("JSON 解析失败，请检查格式");
    }
  }

  const record = asRecord(parsed);
  const characterCandidates = Array.isArray(parsed)
    ? parsed
    : readArrayByKeys(record, ["人物", "角色", "characters", "character", "人物预设", "角色预设"]);
  const environmentCandidates = readArrayByKeys(record, ["环境", "场景", "environments", "environment", "场景预设", "环境预设"]);

  const characters = characterCandidates
    .map((item) => normalizeWorldviewEntity(item))
    .filter((item): item is WorldviewDraftEntity => item !== null);
  const environments = environmentCandidates
    .map((item) => normalizeWorldviewEntity(item))
    .filter((item): item is WorldviewDraftEntity => item !== null);

  if (characters.length === 0 && environments.length === 0) {
    throw new Error("未解析到人物或环境，请检查字段是否为“人物 / 环境”");
  }

  return { characters, environments };
}

function resolveWorldviewPreviewUrl(input: { visualSpec?: Record<string, unknown>; primaryAsset?: { publicUrl?: string } }): string {
  const primary = asText(input.primaryAsset?.publicUrl);
  if (primary) {
    return primary;
  }
  const spec = asRecord(input.visualSpec);
  if (!spec) {
    return "";
  }

  const topLevel =
    asText(spec.image) ||
    asText(spec.imageUrl) ||
    asText(spec.image_url) ||
    asText(spec.previewImageUrl) ||
    asText(spec.preview_image_url) ||
    asText(spec.coverImageUrl) ||
    asText(spec.url);
  if (topLevel) {
    return topLevel;
  }

  const images = Array.isArray(spec.images) ? spec.images : [];
  for (const item of images) {
    const imageRecord = asRecord(item);
    if (!imageRecord) {
      continue;
    }
    const fromList =
      asText(imageRecord.url) ||
      asText(imageRecord.imageUrl) ||
      asText(imageRecord.image_url) ||
      asText(imageRecord.previewImageUrl);
    if (fromList) {
      return fromList;
    }
  }

  return "";
}

const CHARACTER_VOICE_PRESET_ID_KEYS = ["voicePresetId", "voice_preset_id", "配音音色ID"] as const;
const CHARACTER_VOICE_PRESET_NAME_KEYS = ["voicePresetName", "voice_preset_name", "配音音色名称"] as const;

function readCharacterVoicePresetID(character: WorkspaceCharacter): string {
  const spec = asRecord(character.visualSpec);
  if (!spec) {
    return "";
  }
  for (const key of CHARACTER_VOICE_PRESET_ID_KEYS) {
    const value = asText(spec[key]);
    if (value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function readCharacterVoicePresetName(character: WorkspaceCharacter): string {
  const spec = asRecord(character.visualSpec);
  if (!spec) {
    return "";
  }
  for (const key of CHARACTER_VOICE_PRESET_NAME_KEYS) {
    const value = asText(spec[key]);
    if (value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function readVoiceSampleAudioUrl(voice: WorkspaceVoicePreset): string {
  const config = asRecord(voice.config);
  return (
    asText(config?.sampleAudioUrl) ||
    asText(config?.sample_audio_url) ||
    asText(config?.audioUrl) ||
    ""
  );
}

function resolveWaveformAudioUrl(rawUrl: string): string {
  if (!rawUrl || typeof window === "undefined") return rawUrl;
  if (rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) return rawUrl;
  try {
    const resolved = new URL(rawUrl, window.location.origin);
    if (resolved.origin === window.location.origin) {
      return resolved.toString();
    }
    if (resolved.protocol === "http:" || resolved.protocol === "https:") {
      return `/api/studio/voices/waveform-audio?url=${encodeURIComponent(resolved.toString())}`;
    }
    return resolved.toString();
  } catch {
    return rawUrl;
  }
}

function formatAudioDuration(seconds?: number | null): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const safe = Math.floor(seconds);
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function GoogleQuantumWaveform({
  url,
  progress,
  onSeek,
  className = "",
}: {
  url: string;
  progress: number;
  onSeek: (p: number) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const sourceUrl = useMemo(() => resolveWaveformAudioUrl(url), [url]);

  useEffect(() => {
    if (!sourceUrl) {
      setLoading(false);
      setPeaks([]);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const analyze = async () => {
      setLoading(true);
      try {
        const resp = await fetch(sourceUrl, { cache: "force-cache", signal: controller.signal });
        if (!resp.ok) {
          throw new Error(`waveform fetch failed: ${resp.status}`);
        }
        const data = await resp.arrayBuffer();
        const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtor) throw new Error("Web Audio not supported");
        const ctx = new AudioCtor();
        try {
          const buffer = await ctx.decodeAudioData(data);
          if (!active) return;
          const raw = buffer.getChannelData(0);
          const samples = 100;
          const size = Math.max(1, Math.floor(raw.length / samples));
          const result: number[] = [];
          for (let i = 0; i < samples; i += 1) {
            const start = size * i;
            let sum = 0;
            for (let j = 0; j < size && start + j < raw.length; j += 1) {
              sum += Math.abs(raw[start + j]);
            }
            result.push(sum / size);
          }
          const max = Math.max(...result, 0);
          setPeaks(result.map((n) => (max > 0 ? n / max : 0.05)));
        } finally {
          void ctx.close().catch(() => undefined);
        }
      } catch {
        if (active) setPeaks([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    void analyze();
    return () => {
      active = false;
      controller.abort();
    };
  }, [sourceUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);
    const count = peaks.length;
    const gap = 1.2;
    const barWidth = Math.max(1.2, (width - gap * (count - 1)) / count);
    const step = barWidth + gap;

    peaks.forEach((peak, index) => {
      const x = index * step;
      const barHeight = Math.max(4, peak * (height * 0.75));
      const y = (height - barHeight) / 2;
      const isPast = index / Math.max(1, count - 1) <= progress;
      ctx.fillStyle = isPast ? "#f43f5e" : "#27272a";
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, barWidth / 2);
      ctx.fill();
    });
  }, [peaks, progress]);

  return (
    <div
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        if (!Number.isFinite(rect.width) || rect.width <= 0) {
          return;
        }
        const ratio = (event.clientX - rect.left) / rect.width;
        const safeRatio = Number.isFinite(ratio) ? ratio : 0;
        const next = Math.max(0, Math.min(1, safeRatio));
        onSeek(next);
      }}
      className={`relative flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm cursor-pointer ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
      ) : (
        <canvas ref={canvasRef} className="h-full w-full" />
      )}
    </div>
  );
}

function LibraryWavePlayer({ sampleAudio }: { sampleAudio: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cleanupAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.onended = null;
    audio.ontimeupdate = null;
    audio.onplay = null;
    audio.onpause = null;
    audio.onloadedmetadata = null;
    audio.ondurationchange = null;
    audio.src = "";
    audioRef.current = null;
  }, []);

  const ensureAudio = useCallback(() => {
    if (!sampleAudio) return null;
    if (audioRef.current && audioRef.current.src === sampleAudio) {
      return audioRef.current;
    }
    cleanupAudio();
    const audio = new Audio(sampleAudio);
    audio.preload = "metadata";
    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
    };
    audio.ontimeupdate = () => {
      if (audio.duration > 0) {
        setProgress(audio.currentTime / audio.duration);
      }
    };
    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    const syncDuration = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    audio.onloadedmetadata = syncDuration;
    audio.ondurationchange = syncDuration;
    audioRef.current = audio;
    return audio;
  }, [cleanupAudio, sampleAudio]);

  const togglePlay = useCallback(() => {
    const audio = ensureAudio();
    if (!audio) {
      toast.info("当前绑定音色暂无样本音频");
      return;
    }
    if (!audio.paused && !audio.ended) {
      audio.pause();
      return;
    }
    void audio.play().catch(() => toast.error("音频播放失败，请稍后重试"));
  }, [ensureAudio]);

  const handleSeek = useCallback(
    (next: number) => {
      if (!Number.isFinite(next)) return;
      const audio = ensureAudio();
      if (!audio) return;
      const duration = audio.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      const safeProgress = Math.max(0, Math.min(1, next));
      const targetTime = safeProgress * duration;
      if (!Number.isFinite(targetTime)) return;
      audio.currentTime = targetTime;
      setProgress(safeProgress);
      if (audio.paused || audio.ended) {
        void audio.play().catch(() => toast.error("音频播放失败，请稍后重试"));
      }
    },
    [ensureAudio],
  );

  useEffect(() => {
    setIsPlaying(false);
    setProgress(0);
    setDuration(null);
    cleanupAudio();
  }, [cleanupAudio, sampleAudio]);

  useEffect(() => {
    return () => cleanupAudio();
  }, [cleanupAudio]);

  if (!sampleAudio) {
    return <p className="text-xs font-semibold text-zinc-400 sm:flex-1">当前绑定音色暂无样本音频</p>;
  }

  return (
    <div className="flex h-11 w-full items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-950 px-2 shadow-inner sm:flex-1">
      <button
        onClick={togglePlay}
        className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/70 bg-zinc-950/75 text-white shadow-md backdrop-blur transition hover:scale-105 hover:bg-zinc-900/85 active:scale-95"
        title={isPlaying ? "暂停" : "播放"}
      >
        {isPlaying ? (
          <span className="flex items-center gap-1">
            <span className="h-3 w-1 rounded-full bg-white" />
            <span className="h-3 w-1 rounded-full bg-white" />
          </span>
        ) : (
          <span className="ml-0.5 block h-0 w-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-white" aria-hidden="true" />
        )}
      </button>

      <div className="h-7 min-w-0 flex-1 overflow-hidden rounded-lg">
        <GoogleQuantumWaveform url={sampleAudio} progress={progress} onSeek={handleSeek} className="h-full w-full rounded-lg" />
      </div>

      <div className="shrink-0 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
        {formatAudioDuration(duration)}
      </div>
    </div>
  );
}

function buildWorldviewSpecEditorValue(spec?: Record<string, unknown>): string {
  try {
    return JSON.stringify(spec ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function parseWorldviewSpecEditorValue(value: string): Record<string, unknown> {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON 必须是对象格式");
  }
  return parsed as Record<string, unknown>;
}

function mergeByID<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const index = new Map<string, T>();
  current.forEach((item) => {
    index.set(item.id, item);
  });
  incoming.forEach((item) => {
    index.set(item.id, item);
  });
  return Array.from(index.values());
}

// --- 基础 UI 组件 ---

const Badge = ({ children, variant = "default", className = "" }: { children: React.ReactNode; variant?: "default" | "success" | "accent"; className?: string }) => {
  const variants: Record<string, string> = {
    default: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
    success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    accent: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  };
  return <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${variants[variant]} ${className}`}>{children}</span>;
};

const Button = ({ children, variant = "default", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost" }) => {
  const variants: Record<string, string> = {
    default: "bg-zinc-900 text-white hover:bg-rose-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-rose-500",
    outline: "border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950",
    ghost: "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100",
  };
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all disabled:opacity-50 appearance-none select-none active:scale-95 ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

function FormInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">{label}</label>
      <input 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder} 
        className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-5 text-sm font-bold outline-none focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 appearance-none transition-all" 
      />
    </div>
  );
}

// --- 列表视图 ---

function MainDashboard({ projects, loading, onShowCreateForm, onOpenProject, onDeleteProject, currentUserID, syncIssue, onRetry }: {
  projects: ProjectCardModel[];
  loading: boolean;
  onShowCreateForm: () => void;
  onOpenProject: (id: string) => void;
  onDeleteProject: (p: ProjectCardModel) => void;
  currentUserID: string;
  syncIssue?: string;
  onRetry?: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => projects.filter(p => (p.title || "").toLowerCase().includes(q.toLowerCase())), [projects, q]);

  if (loading && projects.length === 0) return (
    <div className="w-full space-y-4 px-4 sm:px-8 py-6">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex h-16 items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 animate-pulse">
          <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-4 w-1/4 rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-4 w-1/2 rounded bg-zinc-50 dark:bg-zinc-900/50" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col bg-white px-3 dark:bg-transparent sm:px-8">
      {syncIssue && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-3 text-xs font-bold text-rose-600 dark:border-rose-900/30 dark:bg-rose-900/20">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} />
            <span>{syncIssue}</span>
          </div>
          {onRetry && <button onClick={onRetry} className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-700 transition-colors"><RefreshCw size={12} /> 立即重试</button>}
        </div>
      )}
      <header className="sticky top-0 z-10 flex shrink-0 flex-col gap-3 border-b border-zinc-100 bg-white/95 py-3 backdrop-blur dark:border-zinc-800/50 dark:bg-zinc-950/80 md:h-16 md:flex-row md:items-center md:justify-between md:gap-0 md:bg-transparent md:py-0 md:backdrop-blur-none">
        <div className="flex items-center gap-3">
          <LayoutDashboard size={18} className="text-rose-500" />
          <h1 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100">创作项目</h1>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:gap-3">
          <div className="relative flex-1 md:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索项目..."
              className="h-10 w-full rounded-full border border-transparent bg-zinc-100/50 pl-9 pr-4 text-xs font-medium outline-none transition-all focus:bg-white focus:ring-2 focus:ring-rose-500/20 dark:bg-zinc-900 md:w-64"
            />
          </div>
          <button
            onClick={onShowCreateForm}
            className="flex h-10 items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 text-xs font-bold text-white transition-colors hover:bg-rose-600 dark:bg-zinc-100 dark:text-zinc-900"
          >
            <Plus size={16} /> 创建新项目
          </button>
        </div>
      </header>

      <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto py-3 sm:py-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm font-semibold text-zinc-500">当前没有匹配的项目</p>
            <button
              onClick={onShowCreateForm}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              <Plus size={14} /> 立即创建
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:hidden">
              {filtered.map((proj) => {
                const canDelete = currentUserID !== "" && proj.ownerId === currentUserID;
                return (
                  <article key={proj.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="mb-3 flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
                        <Film size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-black text-zinc-900 dark:text-zinc-100">{proj.title}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge variant={proj.statusLabel === "已完成" ? "success" : proj.statusLabel === "进行中" ? "accent" : "default"}>
                            {proj.statusLabel}
                          </Badge>
                          <Badge variant="default">{proj.visibilityLabel}</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-zinc-500">
                        <span>{proj.stage}</span>
                        <span>{proj.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div className="h-full bg-rose-500 transition-all duration-700" style={{ width: `${proj.progress}%` }} />
                      </div>
                    </div>

                    <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
                      <div className="flex min-w-0 items-center gap-2">
                        <img src={proj.ownerAvatar} alt={proj.ownerLabel} className="h-5 w-5 rounded-full border border-zinc-200" />
                        <span className="truncate font-semibold">{proj.ownerLabel}</span>
                      </div>
                      <span className="flex shrink-0 items-center gap-1">
                        <Clock size={12} /> {proj.updated}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenProject(proj.id)}
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-full border border-zinc-200 px-4 text-[11px] font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                      >
                        进入项目 <ChevronRight size={14} />
                      </button>
                      {canDelete ? (
                        <button
                          title="删除项目"
                          onClick={() => onDeleteProject(proj)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-zinc-700 dark:hover:bg-red-500/10"
                        >
                          <Trash2 size={15} />
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden xl:block">
              <div className="custom-scrollbar overflow-x-auto">
                <div className="min-w-[1120px]">
                  <div className="flex items-center border-b border-zinc-100 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:border-zinc-800">
                    <div className="min-w-[360px] flex-[1.4]">项目名称 / 当前阶段</div>
                    <div className="w-40 text-center">创作进度</div>
                    <div className="w-40">归属者</div>
                    <div className="w-32">更新时间</div>
                    <div className="w-52 text-right">管理</div>
                  </div>
                  <div className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                    {filtered.map((proj) => {
                      const canDelete = currentUserID !== "" && proj.ownerId === currentUserID;
                      return (
                        <div key={proj.id} className="group flex items-center gap-0 px-4 py-5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                          <div className="flex min-w-[360px] flex-[1.4] items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 transition-colors group-hover:bg-rose-600 group-hover:text-white dark:bg-zinc-800">
                              <Film size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h3 className="truncate text-sm font-black text-zinc-900 dark:text-zinc-100">{proj.title}</h3>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                <Badge className="whitespace-nowrap" variant={proj.statusLabel === "已完成" ? "success" : proj.statusLabel === "进行中" ? "accent" : "default"}>
                                  {proj.statusLabel}
                                </Badge>
                                <Badge className="whitespace-nowrap" variant="default">{proj.visibilityLabel}</Badge>
                                <Badge className="whitespace-nowrap" variant="default">{proj.stage}</Badge>
                                <span className="whitespace-nowrap text-[10px] font-mono text-zinc-400">ID: {proj.id.slice(0, 8)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="w-40 px-4">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                              <div className="h-full bg-rose-500 transition-all duration-1000" style={{ width: `${proj.progress}%` }} />
                            </div>
                            <p className="mt-1 text-center text-[10px] font-black text-zinc-400">{proj.progress}%</p>
                          </div>

                          <div className="w-40">
                            <div className="flex items-center gap-2">
                              <img src={proj.ownerAvatar} alt={proj.ownerLabel} className="h-6 w-6 rounded-full border border-zinc-200 object-cover" />
                              <span className="truncate text-xs font-semibold text-zinc-600">{proj.ownerLabel}</span>
                            </div>
                          </div>
                          <div className="w-32 text-xs font-medium text-zinc-500">
                            <div className="flex items-center gap-1.5">
                              <Clock size={12} /> {proj.updated}
                            </div>
                          </div>

                          <div className="flex w-52 items-center justify-end gap-2">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenProject(proj.id);
                              }}
                              className="inline-flex items-center justify-center gap-1 rounded-full border border-zinc-200 px-4 py-1.5 text-[11px] font-semibold text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-white hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                            >
                              进入项目
                              <ChevronRight size={14} />
                            </button>
                            {canDelete ? (
                              <button
                                title="删除项目"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteProject(proj);
                                }}
                                className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                              >
                                <Trash2 size={16} />
                              </button>
                            ) : (
                              <span className="whitespace-nowrap text-[10px] font-semibold text-zinc-400">仅归属者可删除</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- 子标签面板 ---

function ScriptTab({ project, onUpdate }: { project: WorkspaceProject; onUpdate?: (data: Partial<WorkspaceProject>) => Promise<void> }) {
  const [content, setContent] = useState(project.description || "");
  const [saving, setSaving] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [modelsWarning, setModelsWarning] = useState<string[]>([]);

  const [scriptSeedInput, setScriptSeedInput] = useState("");
  const [generationProvider, setGenerationProvider] = useState<ScriptGenerationProvider>("gemini");
  const [modelInput, setModelInput] = useState<string>("");
  const [writeMode, setWriteMode] = useState<"append" | "replace">("append");

  const [geminiThinkingLevel, setGeminiThinkingLevel] = useState<GeminiThinkingLevel>("medium");
  const [ollamaThinkMode, setOllamaThinkMode] = useState<OllamaThinkMode>("none");
  const [ollamaThinkBoolean, setOllamaThinkBoolean] = useState(true);
  const [ollamaThinkString, setOllamaThinkString] = useState("medium");
  const [modelsCatalog, setModelsCatalog] = useState<ScriptModelsResponse>({
    providers: {
      gemini: {
        textModels: [],
        imageModels: [],
        defaultTextModel: "",
        defaultImageModel: "",
        thinking: {
          supportsLevel: true,
          levelOptions: ["minimal", "low", "medium", "high"],
          supportsBudget: true,
          supportsBoolean: false,
          supportsString: false,
          stringSuggestions: [],
        },
      },
      ollama: {
        textModels: [],
        imageModels: [],
        defaultTextModel: "",
        defaultImageModel: "",
        thinking: {
          supportsLevel: false,
          levelOptions: [],
          supportsBudget: false,
          supportsBoolean: true,
          supportsString: true,
          stringSuggestions: ["low", "medium", "high"],
        },
      },
    },
    warnings: [],
    warningsByProvider: {},
  });

  useEffect(() => {
    setContent(project.description || "");
  }, [project.description]);

  useEffect(() => {
    if (!showGenerateModal) {
      return;
    }
    let cancelled = false;
    setLoadingModels(true);
    setModelsError("");
    void fetch("/api/studio/script/models", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ScriptModelsResponse | { error?: string } | null;
        if (!response.ok) {
          const message = (payload && "error" in payload && payload.error) || `模型清单加载失败 (${response.status})`;
          throw new Error(message);
        }
        if (!payload || !("providers" in payload)) {
          throw new Error("模型清单格式错误");
        }
        if (cancelled) {
          return;
        }
        setModelsCatalog(payload);
        setModelsWarning(payload.warnings || []);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "模型清单加载失败";
        setModelsError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingModels(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showGenerateModal]);

  useEffect(() => {
    const providerCatalog = modelsCatalog.providers[generationProvider];
    if (!providerCatalog) {
      return;
    }
    const textModels = providerCatalog.textModels;
    if (textModels.length === 0) {
      if (modelInput !== "") {
        setModelInput("");
      }
      return;
    }
    if (!modelInput || !textModels.includes(modelInput)) {
      setModelInput(providerCatalog.defaultTextModel || textModels[0] || "");
    }
  }, [generationProvider, modelInput, modelsCatalog]);

  useEffect(() => {
    const currentModels = modelsCatalog.providers[generationProvider]?.textModels ?? [];
    if (currentModels.length > 0) {
      return;
    }
    if (generationProvider === "gemini" && (modelsCatalog.providers.ollama?.textModels?.length ?? 0) > 0) {
      setGenerationProvider("ollama");
      return;
    }
    if (generationProvider === "ollama" && (modelsCatalog.providers.gemini?.textModels?.length ?? 0) > 0) {
      setGenerationProvider("gemini");
    }
  }, [generationProvider, modelsCatalog]);

  useEffect(() => {
    if (generationProvider !== "gemini") {
      return;
    }
    const thinking = modelsCatalog.providers[generationProvider]?.thinking;
    const levels = thinking?.levelOptions?.length
      ? thinking.levelOptions
      : ["minimal", "low", "medium", "high"];
    if (!levels.includes(geminiThinkingLevel)) {
      setGeminiThinkingLevel((levels[0] as GeminiThinkingLevel) || "medium");
    }
  }, [generationProvider, geminiThinkingLevel, modelsCatalog]);

  useEffect(() => {
    if (generationProvider !== "ollama") {
      return;
    }
    const thinking = modelsCatalog.providers[generationProvider]?.thinking;
    if (ollamaThinkMode === "boolean" && !thinking?.supportsBoolean) {
      setOllamaThinkMode(thinking?.supportsString ? "string" : "none");
      return;
    }
    if (ollamaThinkMode === "string" && !thinking?.supportsString) {
      setOllamaThinkMode(thinking?.supportsBoolean ? "boolean" : "none");
    }
  }, [generationProvider, ollamaThinkMode, modelsCatalog]);

  const handleSave = async () => {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate({ description: content });
      toast.success("内容已保存");
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateScript = async () => {
    const normalizedScriptSeed = scriptSeedInput.trim();
    const providerCatalog = modelsCatalog.providers[generationProvider];
    if (!normalizedScriptSeed) {
      toast.error("请先输入大纲与提示要求");
      return;
    }
    if (!providerCatalog?.textModels?.length) {
      toast.error("当前服务暂无可用文本模型");
      return;
    }
    if (!modelInput.trim()) {
      toast.error("请先选择文本模型");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/studio/script/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: generationProvider,
          model: modelInput.trim(),
          brief: normalizedScriptSeed,
          geminiThinkingLevel,
          ollamaThinkMode,
          ollamaThinkBoolean,
          ollamaThinkString: ollamaThinkString.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; content?: string; modelUsed?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || `剧本生成失败 (${response.status})`);
      }

      const generated = (payload?.content ?? "").trim();
      if (!generated) {
        throw new Error("模型未返回内容，请调整输入后重试");
      }

      setContent((prev) => {
        if (writeMode === "replace") {
          return generated;
        }
        if (!prev.trim()) {
          return generated;
        }
        return `${prev.trim()}\n\n${generated}`;
      });
      setShowGenerateModal(false);
      toast.success(`剧本生成完成（${payload?.modelUsed ?? "默认模型"}）`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "剧本生成失败");
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedProviderCatalog = modelsCatalog.providers[generationProvider];
  const providerTextModels = selectedProviderCatalog?.textModels ?? [];
  const providerThinking = selectedProviderCatalog?.thinking;
  const selectedProviderWarning = modelsCatalog.warningsByProvider?.[generationProvider] ?? "";
  const hasChanged = content !== (project.description || "");

  return (
    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col gap-4 px-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">剧本文稿</h2>
          <p className="text-xs font-medium text-zinc-500">在此粘贴您的剧本或小说正文。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          {hasChanged && (
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-500 animate-pulse">未保存的内容</span>
          )}
          <Button 
            variant={hasChanged ? "default" : "outline"} 
            onClick={handleSave} 
            disabled={saving || !hasChanged}
            className={hasChanged ? "bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20" : "h-9 text-xs px-4"}
          >
            {saving ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
            保存修改
          </Button>
          <Button variant="outline" className="h-9 text-xs px-4" onClick={() => setShowGenerateModal(true)}>使用大纲生成剧本</Button>
        </div>
      </div>
      <div className="w-full">
        <textarea
          className="h-[60vh] w-full resize-none rounded-[32px] border border-zinc-200 bg-zinc-50/50 p-6 text-base leading-relaxed outline-none transition-all focus:border-rose-300 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:focus:bg-zinc-950 sm:h-[650px] sm:p-10 sm:text-lg custom-scrollbar"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="在这里输入您的内容..."
        />
      </div>

      {showGenerateModal && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] animate-in fade-in sm:items-center sm:p-4">
          <div className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 animate-in zoom-in-95 duration-200 sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-8 sm:py-6">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">使用大纲生成剧本</h3>
                <p className="mt-1 text-xs font-medium text-zinc-500">输入完整的大纲与写作要求，选择模型后自动生成剧本文稿。</p>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-900"
                disabled={isGenerating}
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <div className="custom-scrollbar flex-1 min-h-0 space-y-6 overflow-y-auto px-4 py-5 sm:space-y-8 sm:px-8 sm:py-8">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">生成服务</label>
                  <select
                    value={generationProvider}
                    onChange={(event) => setGenerationProvider(event.target.value as ScriptGenerationProvider)}
                    className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold outline-none focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <option value="gemini">Gemini 服务</option>
                    <option value="ollama">Ollama 服务</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">写入方式</label>
                  <select
                    value={writeMode}
                    onChange={(event) => setWriteMode(event.target.value as "append" | "replace")}
                    className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold outline-none focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <option value="append">追加到当前文稿尾部</option>
                    <option value="replace">替换当前全部文稿</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">模型</label>
                <select
                  value={modelInput}
                  onChange={(event) => setModelInput(event.target.value)}
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold outline-none focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  disabled={loadingModels || providerTextModels.length === 0}
                >
                  {loadingModels ? (
                    <option value="">正在加载模型列表...</option>
                  ) : null}
                  {!loadingModels && providerTextModels.length === 0 ? (
                    <option value="">当前服务暂无文本模型</option>
                  ) : null}
                  {!loadingModels
                    ? providerTextModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))
                    : null}
                </select>
                {modelsError ? (
                  <p className="text-xs font-semibold text-rose-500">模型清单加载失败：{modelsError}</p>
                ) : null}
                {!modelsError && selectedProviderWarning ? (
                  <p className="text-xs font-semibold text-amber-600">{selectedProviderWarning}</p>
                ) : null}
                {!modelsError && !selectedProviderWarning && modelsWarning.length > 0 ? (
                  <p className="text-xs font-semibold text-amber-600">{modelsWarning[0]}</p>
                ) : null}
              </div>

              {generationProvider === "gemini" ? (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">思考深度</label>
                    <select
                      value={geminiThinkingLevel}
                      onChange={(event) => setGeminiThinkingLevel(event.target.value as GeminiThinkingLevel)}
                      className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold outline-none focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      {(providerThinking?.levelOptions?.length
                        ? providerThinking.levelOptions
                        : ["minimal", "low", "medium", "high"]
                      ).map((level) => (
                        <option key={level} value={level}>
                          {level === "minimal" ? "极简" : level === "low" ? "低" : level === "medium" ? "中" : "高"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">思考模式</label>
                    <select
                      value={ollamaThinkMode}
                      onChange={(event) => setOllamaThinkMode(event.target.value as OllamaThinkMode)}
                      className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold outline-none focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <option value="none">不启用</option>
                      {providerThinking?.supportsBoolean ? <option value="boolean">开关控制</option> : null}
                      {providerThinking?.supportsString ? <option value="string">强度级别</option> : null}
                    </select>
                  </div>
                  {ollamaThinkMode === "boolean" ? (
                    <div className="space-y-2">
                      <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">开关状态</label>
                      <select
                        value={ollamaThinkBoolean ? "true" : "false"}
                        onChange={(event) => setOllamaThinkBoolean(event.target.value === "true")}
                        className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold outline-none focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <option value="true">开启</option>
                        <option value="false">关闭</option>
                      </select>
                    </div>
                  ) : null}
                  {ollamaThinkMode === "string" ? (
                    <div className="space-y-2">
                      <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">思考强度</label>
                      <select
                        value={ollamaThinkString}
                        onChange={(event) => setOllamaThinkString(event.target.value)}
                        className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold outline-none focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        {(providerThinking?.stringSuggestions?.length ? providerThinking.stringSuggestions : ["low", "medium", "high"]).map((option) => (
                          <option key={option} value={option}>
                            {option === "low" ? "低" : option === "medium" ? "中" : option === "high" ? "高" : option}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="space-y-2">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">大纲与提示要求</label>
                <textarea
                  value={scriptSeedInput}
                  onChange={(event) => setScriptSeedInput(event.target.value)}
                  className="h-52 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed outline-none transition-all focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  placeholder="请在这里一次性输入：剧情大纲、人物关系、文风要求、叙事节奏、格式偏好等。"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:px-8 sm:py-5">
              <button
                onClick={() => setShowGenerateModal(false)}
                disabled={isGenerating}
                className="w-full rounded-xl border border-zinc-200 py-3 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 sm:flex-1"
              >
                取消
              </button>
              <button
                onClick={() => void handleGenerateScript()}
                disabled={isGenerating || !scriptSeedInput.trim() || !modelInput.trim()}
                className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-rose-500 sm:flex-[1.6]"
              >
                {isGenerating ? <Loader2 size={18} className="mx-auto animate-spin" /> : (
                  <span className="inline-flex items-center gap-2">
                    <Sparkles size={16} />
                    立即生成剧本
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function StyleTab({
  styles = [],
  project,
  onUpdateProject,
}: {
  styles: WorkspaceStylePreset[];
  project: WorkspaceProject;
  onUpdateProject?: (data: Partial<WorkspaceProject>) => Promise<void>;
}) {
  const savedSelectedStyleId = useMemo(() => readSelectedStyleIdFromTags(project.tags || []), [project.tags]);
  const [selectedStyleId, setSelectedStyleId] = useState(savedSelectedStyleId);
  const [savingStyle, setSavingStyle] = useState(false);

  useEffect(() => {
    setSelectedStyleId(savedSelectedStyleId);
  }, [savedSelectedStyleId]);

  const styleItems = styles
    .filter((item) => item?.id)
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
      return Number.isFinite(rightTime - leftTime) ? rightTime - leftTime : 0;
    });

  const selectedStyle = styleItems.find((item) => item.id === selectedStyleId) || null;
  const hasPendingChanges = selectedStyleId !== savedSelectedStyleId;

  const handleSaveSelectedStyle = async () => {
    if (!onUpdateProject) {
      return;
    }
    if (!selectedStyleId) {
      toast.error("请先选择一个视觉风格");
      return;
    }
    setSavingStyle(true);
    try {
      const nextTags = withSelectedStyleTag(project.tags || [], selectedStyleId);
      await onUpdateProject({ tags: nextTags });
      toast.success("项目基础风格已更新");
    } catch {
      toast.error("保存项目风格失败");
    } finally {
      setSavingStyle(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <section className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="text-xs font-black uppercase tracking-wider text-zinc-500">视觉风格说明</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          这里选择的是当前项目的整体画风基线。后续分镜生成图片时，系统会把所选风格作为基础样式，自动叠加到镜头提示词中。
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <span className="text-zinc-500">当前基础风格：</span>
            <span className="ml-1 font-bold text-zinc-900 dark:text-zinc-100">
              {selectedStyle?.name || "未设置"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveSelectedStyle()}
            disabled={!selectedStyleId || !hasPendingChanges || savingStyle}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-rose-500"
          >
            {savingStyle ? <Loader2 size={16} className="animate-spin" /> : "保存为项目基础风格"}
          </button>
        </div>
      </section>

      <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {styleItems.length === 0 ? (
        <div className="col-span-full py-16 text-center text-zinc-400">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500 dark:bg-zinc-900">
            <Palette size={20} />
          </div>
          <p className="text-sm font-bold">当前项目还没有可用风格</p>
          <p className="mt-1 text-xs">请先在资料库创建艺术风格，再回到本项目使用。</p>
        </div>
      ) : (
        styleItems.map((style) => {
          const description = getStyleDescription(style);
          const previewUrl = getStylePreviewUrl(style);
          const filteredSpec = filterInternalKeys(style.spec ?? {});
          const specJson = JSON.stringify(filteredSpec, null, 2);

          return (
            <button
              type="button"
              key={style.id}
              onClick={() => setSelectedStyleId(style.id)}
              className={`overflow-hidden rounded-3xl border bg-white text-left shadow-sm transition-all hover:border-rose-200 dark:bg-zinc-900/40 ${
                selectedStyleId === style.id
                  ? "border-rose-400 ring-2 ring-rose-200 dark:border-rose-500 dark:ring-rose-900/30"
                  : "border-zinc-100 dark:border-zinc-800 dark:hover:border-rose-900/40"
              }`}
            >
              <div className="relative aspect-[16/10] border-b border-zinc-100 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950">
                {previewUrl ? (
                  <img src={previewUrl} alt={style.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-100 via-zinc-50 to-zinc-100 text-zinc-400 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900 dark:text-zinc-600">
                    <Palette size={28} />
                  </div>
                )}
                <div className="absolute left-4 top-4 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white backdrop-blur">
                  视觉风格
                </div>
                {selectedStyleId === style.id ? (
                  <div className="absolute right-4 top-4 rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-black tracking-wider text-white">
                    已选中
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 p-5">
                <h3 className="line-clamp-1 text-base font-black text-zinc-900 dark:text-zinc-100">{style.name}</h3>
                <p className="line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {description || "暂无风格描述"}
                </p>
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/80">
                  <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-zinc-400">风格 JSON</p>
                  <JsonCodePreview value={specJson} className="max-h-36 text-[10px]" />
                </div>
              </div>
            </button>
          );
        })
      )}
      </div>
    </div>
  );
}

function WorldviewView({
  project,
  characters = [],
  environments = [],
  onImported,
}: {
  project: WorkspaceProject;
  characters: WorkspaceCharacter[];
  environments: WorkspaceEnvironment[];
  onImported?: (payload: { characters: WorkspaceCharacter[]; environments: WorkspaceEnvironment[] }) => void;
}) {
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualJsonText, setManualJsonText] = useState("");
  const [manualParsed, setManualParsed] = useState<ParsedWorldviewPayload | null>(null);
  const [manualError, setManualError] = useState("");
  const [manualImporting, setManualImporting] = useState(false);

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiProvider, setAiProvider] = useState<ScriptGenerationProvider>("gemini");
  const [aiModel, setAiModel] = useState("");
  const [aiScript, setAiScript] = useState(project.description || "");
  const [aiInstruction, setAiInstruction] = useState("提取主角、配角与关键场景，并补全可用于生图的视觉信息。");
  const [aiLoadingModels, setAiLoadingModels] = useState(false);
  const [aiModelsError, setAiModelsError] = useState("");
  const [aiModelsWarning, setAiModelsWarning] = useState<string[]>([]);
  const [aiCatalog, setAiCatalog] = useState<ScriptModelsResponse>({
    providers: {
      gemini: {
        textModels: [],
        imageModels: [],
        defaultTextModel: "",
        defaultImageModel: "",
        thinking: {
          supportsLevel: true,
          levelOptions: ["minimal", "low", "medium", "high"],
          supportsBudget: true,
          supportsBoolean: false,
          supportsString: false,
          stringSuggestions: [],
        },
      },
      ollama: {
        textModels: [],
        imageModels: [],
        defaultTextModel: "",
        defaultImageModel: "",
        thinking: {
          supportsLevel: false,
          levelOptions: [],
          supportsBudget: false,
          supportsBoolean: true,
          supportsString: true,
          stringSuggestions: ["low", "medium", "high"],
        },
      },
    },
    warnings: [],
    warningsByProvider: {},
  });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResultText, setAiResultText] = useState("");
  const [aiParsed, setAiParsed] = useState<ParsedWorldviewPayload | null>(null);
  const [aiParseError, setAiParseError] = useState("");
  const [aiImporting, setAiImporting] = useState(false);

  const [viewingTarget, setViewingTarget] = useState<WorldviewViewerTarget | null>(null);
  const [viewerName, setViewerName] = useState("");
  const [viewerSpecText, setViewerSpecText] = useState("{}");
  const [viewerPreviewImage, setViewerPreviewImage] = useState("");
  const [viewerPreviewMode, setViewerPreviewMode] = useState<"upload" | "gemini">("upload");
  const [viewerAspectRatio, setViewerAspectRatio] = useState("16:9");
  const [viewerResolution, setViewerResolution] = useState("1024x1024");
  const [viewerPreviewModel, setViewerPreviewModel] = useState("");
  const [viewerSaving, setViewerSaving] = useState(false);
  const [viewerUploading, setViewerUploading] = useState(false);
  const [viewerGenerating, setViewerGenerating] = useState(false);
  const viewerFileInputRef = useRef<HTMLInputElement | null>(null);

  const closeViewer = useCallback(() => {
    setViewingTarget(null);
    setViewerName("");
    setViewerSpecText("{}");
    setViewerPreviewImage("");
    setViewerPreviewMode("upload");
    setViewerAspectRatio("16:9");
    setViewerResolution("1024x1024");
    setViewerSaving(false);
    setViewerUploading(false);
    setViewerGenerating(false);
    if (viewerFileInputRef.current) {
      viewerFileInputRef.current.value = "";
    }
  }, []);

  const openViewer = useCallback((target: WorldviewViewerTarget) => {
    setViewingTarget(target);
    setViewerName(target.item.name || "");
    setViewerSpecText(buildWorldviewSpecEditorValue(target.item.visualSpec));
    setViewerPreviewImage(resolveWorldviewPreviewUrl(target.item));
    setViewerPreviewMode("upload");
    setViewerAspectRatio("16:9");
    setViewerResolution("1024x1024");
  }, []);

  useEffect(() => {
    setAiScript(project.description || "");
    setAiResultText("");
    setAiParsed(null);
    setAiParseError("");
  }, [project.id, project.description]);

  useEffect(() => {
    const trimmed = manualJsonText.trim();
    if (!trimmed) {
      setManualParsed(null);
      setManualError("");
      return;
    }
    try {
      const parsed = parseWorldviewPayload(trimmed);
      setManualParsed(parsed);
      setManualError("");
    } catch (error) {
      setManualParsed(null);
      setManualError(error instanceof Error ? error.message : "JSON 解析失败");
    }
  }, [manualJsonText]);

  useEffect(() => {
    const trimmed = aiResultText.trim();
    if (!trimmed) {
      setAiParsed(null);
      setAiParseError("");
      return;
    }
    try {
      const parsed = parseWorldviewPayload(trimmed);
      setAiParsed(parsed);
      setAiParseError("");
    } catch (error) {
      setAiParsed(null);
      setAiParseError(error instanceof Error ? error.message : "解析失败");
    }
  }, [aiResultText]);

  useEffect(() => {
    if (!showAiModal && !viewingTarget) {
      return;
    }
    let cancelled = false;
    setAiLoadingModels(true);
    setAiModelsError("");
    void fetch("/api/studio/script/models", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ScriptModelsResponse | { error?: string } | null;
        if (!response.ok) {
          const message = (payload && "error" in payload && payload.error) || `模型清单加载失败 (${response.status})`;
          throw new Error(message);
        }
        if (!payload || !("providers" in payload)) {
          throw new Error("模型清单格式错误");
        }
        if (cancelled) {
          return;
        }
        setAiCatalog(payload);
        setAiModelsWarning(payload.warnings || []);
      })
      .catch((error) => {
        if (!cancelled) {
          setAiModelsError(error instanceof Error ? error.message : "模型清单加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAiLoadingModels(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showAiModal, viewingTarget]);

  useEffect(() => {
    const providerCatalog = aiCatalog.providers[aiProvider];
    if (!providerCatalog) {
      return;
    }
    const textModels = providerCatalog.textModels || [];
    if (textModels.length === 0) {
      if (aiModel !== "") {
        setAiModel("");
      }
      return;
    }
    if (!aiModel || !textModels.includes(aiModel)) {
      setAiModel(providerCatalog.defaultTextModel || textModels[0] || "");
    }
  }, [aiProvider, aiModel, aiCatalog]);

  useEffect(() => {
    const currentModels = aiCatalog.providers[aiProvider]?.textModels ?? [];
    if (currentModels.length > 0) {
      return;
    }
    if (aiProvider === "gemini" && (aiCatalog.providers.ollama?.textModels?.length ?? 0) > 0) {
      setAiProvider("ollama");
      return;
    }
    if (aiProvider === "ollama" && (aiCatalog.providers.gemini?.textModels?.length ?? 0) > 0) {
      setAiProvider("gemini");
    }
  }, [aiProvider, aiCatalog]);

  useEffect(() => {
    if (!viewingTarget) {
      return;
    }
    const imageModels = aiCatalog.providers.gemini?.imageModels ?? [];
    if (imageModels.length === 0) {
      if (viewerPreviewModel !== "") {
        setViewerPreviewModel("");
      }
      return;
    }
    if (!viewerPreviewModel || !imageModels.includes(viewerPreviewModel)) {
      setViewerPreviewModel(aiCatalog.providers.gemini?.defaultImageModel || imageModels[0] || "");
    }
  }, [viewingTarget, viewerPreviewModel, aiCatalog]);

  const importParsedPayload = useCallback(
    async (payload: ParsedWorldviewPayload) => {
      const characterTasks = payload.characters.map((item) =>
        fetchJSON<WorkspaceCharacter>(`/api/studio/projects/${project.id}/characters`, {
          method: "POST",
          body: JSON.stringify({
            name: item.name,
            title: item.title || item.name,
            visualSpec: item.visualSpec ?? {},
          }),
        }),
      );
      const environmentTasks = payload.environments.map((item) =>
        fetchJSON<WorkspaceEnvironment>(`/api/studio/projects/${project.id}/environments`, {
          method: "POST",
          body: JSON.stringify({
            name: item.name,
            visualSpec: item.visualSpec ?? {},
          }),
        }),
      );

      const [characterResults, environmentResults] = await Promise.all([
        Promise.allSettled(characterTasks),
        Promise.allSettled(environmentTasks),
      ]);

      const createdCharacters = characterResults
        .filter((result): result is PromiseFulfilledResult<WorkspaceCharacter> => result.status === "fulfilled")
        .map((result) => result.value);
      const createdEnvironments = environmentResults
        .filter((result): result is PromiseFulfilledResult<WorkspaceEnvironment> => result.status === "fulfilled")
        .map((result) => result.value);

      const errors = [...characterResults, ...environmentResults]
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => (result.reason instanceof Error ? result.reason.message : "导入失败"));

      if (createdCharacters.length === 0 && createdEnvironments.length === 0 && errors.length > 0) {
        throw new Error(errors[0]);
      }

      if (createdCharacters.length || createdEnvironments.length) {
        onImported?.({ characters: createdCharacters, environments: createdEnvironments });
      }

      const successSummary = `已导入 人物 ${createdCharacters.length} 个，场景 ${createdEnvironments.length} 个`;
      toast.success(successSummary);
      if (errors.length > 0) {
        toast.error(`部分导入失败：${errors[0]}`);
      }
    },
    [onImported, project.id],
  );

  const handleManualImport = async () => {
    if (!manualParsed) {
      toast.error("请先输入有效 JSON");
      return;
    }
    setManualImporting(true);
    try {
      await importParsedPayload(manualParsed);
      setShowManualModal(false);
      setManualJsonText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setManualImporting(false);
    }
  };

  const handleGenerateWithAi = async () => {
    if (!aiScript.trim()) {
      toast.error("请先输入剧本文稿");
      return;
    }
    if (!aiModel.trim()) {
      toast.error("请先选择模型");
      return;
    }

    setAiGenerating(true);
    try {
      const response = await fetchJSON<WorldviewGenerationResponse>("/api/studio/worldview/generate", {
        method: "POST",
        body: JSON.stringify({
          provider: aiProvider,
          model: aiModel,
          script: aiScript.trim(),
          instruction: aiInstruction.trim(),
        }),
      });
      const generated = response.content?.trim() || "";
      if (!generated) {
        throw new Error("模型未返回可用内容");
      }
      setAiResultText(generated);
      toast.success(`人物与场景已生成（${response.modelUsed || "默认模型"}）`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成人物与场景失败");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAiImport = async () => {
    if (!aiParsed) {
      toast.error("请先生成并确认 JSON");
      return;
    }
    setAiImporting(true);
    try {
      await importParsedPayload(aiParsed);
      setShowAiModal(false);
      setAiResultText("");
      setAiParsed(null);
      setAiParseError("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setAiImporting(false);
    }
  };

  const handleUploadViewerImage = async (file: File) => {
    if (!viewingTarget) {
      return;
    }
    setViewerUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assetId", viewingTarget.item.id);
      formData.append("assetType", viewingTarget.type);
      const response = await fetch("/api/studio/assets/preview/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || `Request failed (${response.status})`);
      }
      const uploadedUrl = asText(payload?.url);
      if (!uploadedUrl) {
        throw new Error("上传成功但未返回图片地址");
      }
      setViewerPreviewImage(uploadedUrl);
      toast.success("预览图已上传");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setViewerUploading(false);
      if (viewerFileInputRef.current) {
        viewerFileInputRef.current.value = "";
      }
    }
  };

  const handleGenerateViewerImage = async () => {
    if (!viewingTarget) {
      return;
    }
    let parsedSpec: Record<string, unknown>;
    try {
      parsedSpec = parseWorldviewSpecEditorValue(viewerSpecText);
      if (Object.keys(parsedSpec).length === 0) {
        toast.error("JSON 定义为空，请先填写后再生成");
        return;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "JSON 解析失败");
      return;
    }
    if (!viewerPreviewModel.trim()) {
      toast.error("请先选择 Gemini 图片模型");
      return;
    }

    setViewerGenerating(true);
    try {
      const payload = await fetchJSON<{ imageUrl?: string; imageDataUrl?: string; imageBase64?: string; modelUsed?: string }>(
        "/api/studio/styles/preview/gemini",
        {
          method: "POST",
          body: JSON.stringify({
            prompt: JSON.stringify(parsedSpec, null, 2),
            model: viewerPreviewModel.trim(),
            aspectRatio: viewerAspectRatio,
            resolution: viewerResolution,
            referenceImages: viewerPreviewImage ? [viewerPreviewImage] : [],
          }),
        },
      );
      const nextImage =
        asText(payload.imageUrl) ||
        asText(payload.imageDataUrl) ||
        (asText(payload.imageBase64) ? `data:image/png;base64,${asText(payload.imageBase64)}` : "");
      if (!nextImage) {
        throw new Error("Gemini 未返回图片");
      }
      setViewerPreviewImage(nextImage);
      toast.success(`图片已生成（${asText(payload.modelUsed) || "默认模型"}）`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 生成失败");
    } finally {
      setViewerGenerating(false);
    }
  };

  const handleSaveViewer = async () => {
    if (!viewingTarget) {
      return;
    }
    const nextName = viewerName.trim() || viewingTarget.item.name || "未命名";

    let parsedSpec: Record<string, unknown>;
    try {
      parsedSpec = parseWorldviewSpecEditorValue(viewerSpecText);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "JSON 解析失败");
      return;
    }

    const nextVisualSpec: Record<string, unknown> = { ...parsedSpec };
    if (viewerPreviewImage) {
      nextVisualSpec.image = viewerPreviewImage;
      nextVisualSpec.imageUrl = viewerPreviewImage;
      nextVisualSpec.previewImageUrl = viewerPreviewImage;
    }

    setViewerSaving(true);
    try {
      if (viewingTarget.type === "characters") {
        const base = viewingTarget.item;
        const updated = await fetchJSON<WorkspaceCharacter>(`/api/studio/characters/${base.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: nextName,
            title: base.title || nextName,
            visualSpec: nextVisualSpec,
          }),
        });
        onImported?.({ characters: [updated], environments: [] });
        setViewingTarget({ type: "characters", item: updated });
        setViewerName(updated.name || nextName);
        setViewerSpecText(buildWorldviewSpecEditorValue(updated.visualSpec));
        setViewerPreviewImage(resolveWorldviewPreviewUrl(updated));
      } else {
        const base = viewingTarget.item;
        const updated = await fetchJSON<WorkspaceEnvironment>(`/api/studio/environments/${base.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: nextName,
            visualSpec: nextVisualSpec,
          }),
        });
        onImported?.({ characters: [], environments: [updated] });
        setViewingTarget({ type: "environments", item: updated });
        setViewerName(updated.name || nextName);
        setViewerSpecText(buildWorldviewSpecEditorValue(updated.visualSpec));
        setViewerPreviewImage(resolveWorldviewPreviewUrl(updated));
      }
      toast.success("资料已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setViewerSaving(false);
    }
  };

  const sortedCharacters = useMemo(
    () =>
      [...characters].sort(
        (left, right) =>
          new Date(right.updatedAt || right.createdAt || 0).getTime() -
          new Date(left.updatedAt || left.createdAt || 0).getTime(),
      ),
    [characters],
  );
  const sortedEnvironments = useMemo(
    () =>
      [...environments].sort(
        (left, right) =>
          new Date(right.updatedAt || right.createdAt || 0).getTime() -
          new Date(left.updatedAt || left.createdAt || 0).getTime(),
      ),
    [environments],
  );

  const aiProviderModels = aiCatalog.providers[aiProvider]?.textModels ?? [];
  const aiProviderWarning = aiCatalog.warningsByProvider?.[aiProvider] ?? "";
  const geminiProviderWarning = aiCatalog.warningsByProvider?.gemini ?? "";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="rounded-3xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">人物与场景设定</h2>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
              支持两种方式：直接粘贴 JSON 导入，或基于剧本文稿让 AI 自动生成人物与环境，再确认导入到当前项目。
            </p>
            <div className="flex items-center gap-3 text-[11px] font-bold text-zinc-500">
              <span>当前人物 {sortedCharacters.length} 个</span>
              <span>·</span>
              <span>当前场景 {sortedEnvironments.length} 个</span>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" className="h-9 text-xs" onClick={() => setShowManualModal(true)}>
              <FileTerminal size={14} />
              手动导入 JSON
            </Button>
            <Button className="h-9 text-xs" onClick={() => setShowAiModal(true)}>
              <Sparkles size={14} />
              AI 生成人物与场景
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">人物列表</h3>
          <span className="text-xs font-semibold text-zinc-500">{sortedCharacters.length} 项</span>
        </div>
        {sortedCharacters.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 px-6 py-12 text-center text-zinc-400 dark:border-zinc-800">
            尚未导入人物设定
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedCharacters.map((item) => {
              const previewUrl = resolveWorldviewPreviewUrl(item);
              const spec = asRecord(item.visualSpec);
              const description =
                asText(spec?.["画面描述"]) ||
                asText(spec?.["主体对象"]) ||
                asText(spec?.description) ||
                "暂无描述";
              return (
                <article key={item.id} className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="relative aspect-[16/10] bg-zinc-100 dark:bg-zinc-900">
                    {previewUrl ? (
                      <img src={previewUrl} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400">
                        <Users size={26} />
                      </div>
                    )}
                    <div className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-black tracking-wider text-white">
                      人物
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    <h4 className="line-clamp-1 text-base font-black text-zinc-900 dark:text-zinc-100">{item.name}</h4>
                    <p className="line-clamp-3 text-xs leading-relaxed text-zinc-500">{description}</p>
                    <button
                      type="button"
                      onClick={() => openViewer({ type: "characters", item })}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                    >
                      <Eye size={14} />
                      查看详情
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">场景列表</h3>
          <span className="text-xs font-semibold text-zinc-500">{sortedEnvironments.length} 项</span>
        </div>
        {sortedEnvironments.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 px-6 py-12 text-center text-zinc-400 dark:border-zinc-800">
            尚未导入场景设定
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sortedEnvironments.map((item) => {
              const previewUrl = resolveWorldviewPreviewUrl(item);
              const spec = asRecord(item.visualSpec);
              const description =
                asText(spec?.["画面描述"]) ||
                asText(spec?.["主体对象"]) ||
                asText(spec?.description) ||
                "暂无描述";
              return (
                <article key={item.id} className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
                  <div className="relative aspect-[16/10] bg-zinc-100 dark:bg-zinc-900">
                    {previewUrl ? (
                      <img src={previewUrl} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400">
                        <Palette size={26} />
                      </div>
                    )}
                    <div className="absolute left-3 top-3 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-black tracking-wider text-white">
                      场景
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    <h4 className="line-clamp-1 text-base font-black text-zinc-900 dark:text-zinc-100">{item.name}</h4>
                    <p className="line-clamp-3 text-xs leading-relaxed text-zinc-500">{description}</p>
                    <button
                      type="button"
                      onClick={() => openViewer({ type: "environments", item })}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
                    >
                      <Eye size={14} />
                      查看详情
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {viewingTarget && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] animate-in fade-in sm:items-center sm:p-4">
              <div className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 animate-in zoom-in-95 duration-200 sm:h-auto sm:max-h-[92vh] sm:max-w-6xl sm:rounded-3xl">
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-8 sm:py-6">
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">
                      {viewingTarget.type === "characters" ? "查看人物详情" : "查看场景详情"}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-zinc-500">可重新上传图片或使用 AI 生成新图，并同步更新 JSON 视觉信息。</p>
                  </div>
                  <button
                    onClick={closeViewer}
                    className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-900"
                    disabled={viewerSaving || viewerUploading || viewerGenerating}
                  >
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>

                <div className="custom-scrollbar grid flex-1 min-h-0 grid-cols-1 gap-5 overflow-y-auto px-4 py-5 sm:px-8 sm:py-8 lg:grid-cols-2">
                  <section className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/30 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400">名称</label>
                      <input
                        value={viewerName}
                        onChange={(event) => setViewerName(event.target.value)}
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400 dark:border-zinc-700 dark:bg-zinc-900"
                        placeholder="输入名称"
                      />
                    </div>

                    <div className="h-[260px] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
                      {viewerPreviewImage ? (
                        <img src={viewerPreviewImage} alt={viewerName || "预览图"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-400">
                          {viewingTarget.type === "characters" ? <Users size={28} /> : <Palette size={28} />}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-900">
                      <button
                        onClick={() => setViewerPreviewMode("upload")}
                        className={`h-9 rounded-lg text-xs font-bold transition-all ${
                          viewerPreviewMode === "upload"
                            ? "bg-white text-rose-600 shadow-sm dark:bg-zinc-800"
                            : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                        }`}
                      >
                        本地上传
                      </button>
                      <button
                        onClick={() => setViewerPreviewMode("gemini")}
                        className={`h-9 rounded-lg text-xs font-bold transition-all ${
                          viewerPreviewMode === "gemini"
                            ? "bg-white text-rose-600 shadow-sm dark:bg-zinc-800"
                            : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                        }`}
                      >
                        AI 生成
                      </button>
                    </div>

                    {viewerPreviewMode === "upload" ? (
                      <div className="space-y-2">
                        <input
                          ref={viewerFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              await handleUploadViewerImage(file);
                            }
                          }}
                        />
                        <button
                          onClick={() => viewerFileInputRef.current?.click()}
                          disabled={viewerUploading}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Upload size={16} />
                          {viewerUploading ? "上传中..." : "上传并覆盖图片"}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400">Gemini 图片模型</label>
                            <select
                              value={viewerPreviewModel}
                              onChange={(event) => setViewerPreviewModel(event.target.value)}
                              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400 dark:border-zinc-700 dark:bg-zinc-900"
                              disabled={aiLoadingModels || (aiCatalog.providers.gemini?.imageModels?.length ?? 0) === 0}
                            >
                              {aiLoadingModels ? <option value="">正在加载模型...</option> : null}
                              {!aiLoadingModels && (aiCatalog.providers.gemini?.imageModels?.length ?? 0) === 0 ? (
                                <option value="">暂无可用图片模型</option>
                              ) : null}
                              {!aiLoadingModels
                                ? (aiCatalog.providers.gemini?.imageModels ?? []).map((model) => (
                                    <option key={model} value={model}>
                                      {model}
                                    </option>
                                  ))
                                : null}
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400">画幅比例</label>
                            <select
                              value={viewerAspectRatio}
                              onChange={(event) => setViewerAspectRatio(event.target.value)}
                              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400 dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              {["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"].map((ratio) => (
                                <option key={ratio} value={ratio}>
                                  {ratio}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400">输出尺寸</label>
                          <select
                            value={viewerResolution}
                            onChange={(event) => setViewerResolution(event.target.value)}
                            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400 dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            {["1024x1024", "1280x720", "1920x1080", "1080x1920", "1536x1024", "1024x1536"].map((resolution) => (
                              <option key={resolution} value={resolution}>
                                {resolution}
                              </option>
                            ))}
                          </select>
                        </div>
                        {aiModelsError ? <p className="text-xs font-semibold text-rose-500">模型清单加载失败：{aiModelsError}</p> : null}
                        {!aiModelsError && geminiProviderWarning ? <p className="text-xs font-semibold text-amber-600">{geminiProviderWarning}</p> : null}
                        <button
                          onClick={() => void handleGenerateViewerImage()}
                          disabled={viewerGenerating || !viewerPreviewModel.trim()}
                          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Sparkles size={16} />
                          {viewerGenerating ? "生成中..." : "使用 AI 生成图片"}
                        </button>
                      </div>
                    )}
                  </section>

                  <section className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/30 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400">视觉信息 JSON</label>
                      <span className="text-[10px] font-bold text-zinc-400">保存时会校验</span>
                    </div>
                    <textarea
                      value={viewerSpecText}
                      onChange={(event) => setViewerSpecText(event.target.value)}
                      className="h-[430px] w-full resize-none rounded-2xl border border-zinc-200 bg-white p-4 font-mono text-[13px] leading-relaxed outline-none transition-all focus:border-rose-500 dark:border-zinc-700 dark:bg-zinc-900"
                      placeholder='例如：{"主体对象":"...","画面描述":"..."}'
                    />
                  </section>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:px-8 sm:py-5">
                  <button
                    onClick={closeViewer}
                    disabled={viewerSaving || viewerUploading || viewerGenerating}
                    className="w-full rounded-xl border border-zinc-200 py-3 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 sm:flex-1"
                  >
                    关闭
                  </button>
                  <button
                    onClick={() => void handleSaveViewer()}
                    disabled={viewerSaving || viewerUploading || viewerGenerating || !viewerName.trim()}
                    className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-rose-500 sm:flex-[1.6]"
                  >
                    {viewerSaving ? <Loader2 size={18} className="mx-auto animate-spin" /> : "保存修改"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showManualModal && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] animate-in fade-in sm:items-center sm:p-4">
              <div className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 animate-in zoom-in-95 duration-200 sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-3xl">
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-8 sm:py-6">
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">手动导入人物与场景 JSON</h3>
                    <p className="mt-1 text-xs font-medium text-zinc-500">支持字段：人物 / 环境（或角色 / 场景）。导入后直接写入当前项目。</p>
                  </div>
                  <button
                    onClick={() => setShowManualModal(false)}
                    className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-900"
                    disabled={manualImporting}
                  >
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>

                <div className="custom-scrollbar flex-1 min-h-0 space-y-5 overflow-y-auto px-4 py-5 sm:px-8 sm:py-8">
                  <textarea
                    value={manualJsonText}
                    onChange={(event) => setManualJsonText(event.target.value)}
                    className="h-[52vh] w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-[13px] leading-relaxed outline-none transition-all focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                    placeholder={'请粘贴 JSON，例如 {"人物": [...], "环境": [...]}。'}
                  />
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                    {manualError ? (
                      <p className="text-xs font-semibold text-rose-500">解析失败：{manualError}</p>
                    ) : manualParsed ? (
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                        解析成功：人物 {manualParsed.characters.length} 个，场景 {manualParsed.environments.length} 个
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500">输入 JSON 后会自动校验结构。</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:px-8 sm:py-5">
                  <button
                    onClick={() => setShowManualModal(false)}
                    disabled={manualImporting}
                    className="w-full rounded-xl border border-zinc-200 py-3 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 sm:flex-1"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void handleManualImport()}
                    disabled={manualImporting || !manualParsed}
                    className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-rose-500 sm:flex-[1.6]"
                  >
                    {manualImporting ? <Loader2 size={18} className="mx-auto animate-spin" /> : "导入到当前项目"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showAiModal && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] animate-in fade-in sm:items-center sm:p-4">
              <div className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 animate-in zoom-in-95 duration-200 sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-3xl">
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-8 sm:py-6">
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">AI 生成人物与场景 JSON</h3>
                    <p className="mt-1 text-xs font-medium text-zinc-500">先选择模型，再输入剧本文稿与补充要求，生成后可手动编辑再导入。</p>
                  </div>
                  <button
                    onClick={() => setShowAiModal(false)}
                    className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-900"
                    disabled={aiGenerating || aiImporting}
                  >
                    <Plus size={24} className="rotate-45" />
                  </button>
                </div>

                <div className="custom-scrollbar flex-1 min-h-0 space-y-6 overflow-y-auto px-4 py-5 sm:px-8 sm:py-8">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">生成服务</label>
                      <select
                        value={aiProvider}
                        onChange={(event) => setAiProvider(event.target.value as ScriptGenerationProvider)}
                        className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold outline-none focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                      >
                        <option value="gemini">Gemini 服务</option>
                        <option value="ollama">Ollama 服务</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">文本模型</label>
                      <select
                        value={aiModel}
                        onChange={(event) => setAiModel(event.target.value)}
                        className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold outline-none focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                        disabled={aiLoadingModels || aiProviderModels.length === 0}
                      >
                        {aiLoadingModels ? <option value="">正在加载模型列表...</option> : null}
                        {!aiLoadingModels && aiProviderModels.length === 0 ? <option value="">当前服务暂无文本模型</option> : null}
                        {!aiLoadingModels
                          ? aiProviderModels.map((model) => (
                              <option key={model} value={model}>
                                {model}
                              </option>
                            ))
                          : null}
                      </select>
                    </div>
                  </div>

                  {aiModelsError ? <p className="text-xs font-semibold text-rose-500">模型清单加载失败：{aiModelsError}</p> : null}
                  {!aiModelsError && aiProviderWarning ? <p className="text-xs font-semibold text-amber-600">{aiProviderWarning}</p> : null}
                  {!aiModelsError && !aiProviderWarning && aiModelsWarning.length > 0 ? (
                    <p className="text-xs font-semibold text-amber-600">{aiModelsWarning[0]}</p>
                  ) : null}

                  <div className="space-y-2">
                    <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">剧本文稿</label>
                    <textarea
                      value={aiScript}
                      onChange={(event) => setAiScript(event.target.value)}
                      className="h-48 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed outline-none transition-all focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                      placeholder="粘贴当前项目的剧本文稿..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">补充要求（可选）</label>
                    <textarea
                      value={aiInstruction}
                      onChange={(event) => setAiInstruction(event.target.value)}
                      className="h-24 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-relaxed outline-none transition-all focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                      placeholder="例如：保留恐怖氛围，重点提取人物四视图与关键空间。"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => void handleGenerateWithAi()}
                      disabled={aiGenerating || !aiScript.trim() || !aiModel.trim()}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-rose-500"
                    >
                      {aiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      生成 JSON
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">生成结果（可编辑）</label>
                    <textarea
                      value={aiResultText}
                      onChange={(event) => setAiResultText(event.target.value)}
                      className="h-64 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-[13px] leading-relaxed outline-none transition-all focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900"
                      placeholder="生成完成后，这里会出现 JSON。你可以先修改再导入。"
                    />
                    {aiParseError ? (
                      <p className="text-xs font-semibold text-rose-500">解析失败：{aiParseError}</p>
                    ) : aiParsed ? (
                      <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                        可导入：人物 {aiParsed.characters.length} 个，场景 {aiParsed.environments.length} 个
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-500">生成并保持合法 JSON 后即可导入。</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:px-8 sm:py-5">
                  <button
                    onClick={() => setShowAiModal(false)}
                    disabled={aiGenerating || aiImporting}
                    className="w-full rounded-xl border border-zinc-200 py-3 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 sm:flex-1"
                  >
                    关闭
                  </button>
                  <button
                    onClick={() => void handleAiImport()}
                    disabled={aiGenerating || aiImporting || !aiParsed}
                    className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-rose-500 sm:flex-[1.6]"
                  >
                    {aiImporting ? <Loader2 size={18} className="mx-auto animate-spin" /> : "导入到当前项目"}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function AudioTab({
  projectID,
  characters = [],
  voices = [],
  onCharactersUpdated,
  onVoicesUpdated,
}: {
  projectID: string;
  characters: WorkspaceCharacter[];
  voices: WorkspaceVoicePreset[];
  onCharactersUpdated?: (items: WorkspaceCharacter[]) => void;
  onVoicesUpdated?: (items: WorkspaceVoicePreset[]) => void;
}) {
  const [bindingCharacterID, setBindingCharacterID] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<WorkspaceCharacter | null>(null);
  const [uploadVoiceName, setUploadVoiceName] = useState("");
  const [uploadVoiceGender, setUploadVoiceGender] = useState("未知");
  const [uploadVoiceFile, setUploadVoiceFile] = useState<File | null>(null);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);

  const voicesByID = useMemo(() => {
    const index = new Map<string, WorkspaceVoicePreset>();
    voices.forEach((item) => index.set(item.id, item));
    return index;
  }, [voices]);

  const sortedVoices = useMemo(
    () =>
      [...voices].sort(
        (left, right) =>
          new Date(right.updatedAt || right.createdAt || 0).getTime() -
          new Date(left.updatedAt || left.createdAt || 0).getTime(),
      ),
    [voices],
  );

  const sortedCharacters = useMemo(
    () =>
      [...characters].sort(
        (left, right) =>
          new Date(right.updatedAt || right.createdAt || 0).getTime() -
          new Date(left.updatedAt || left.createdAt || 0).getTime(),
      ),
    [characters],
  );

  const closeUploadModal = useCallback(() => {
    setShowUploadModal(false);
    setUploadTarget(null);
    setUploadVoiceName("");
    setUploadVoiceGender("未知");
    setUploadVoiceFile(null);
    setUploadingVoice(false);
    if (uploadFileInputRef.current) {
      uploadFileInputRef.current.value = "";
    }
  }, []);

  const buildNextCharacterSpec = useCallback(
    (character: WorkspaceCharacter, voice: WorkspaceVoicePreset | null): Record<string, unknown> => {
      const base = asRecord(character.visualSpec) ? { ...(character.visualSpec as Record<string, unknown>) } : {};
      if (!voice) {
        delete base.voicePresetId;
        delete base.voice_preset_id;
        delete base["配音音色ID"];
        delete base.voicePresetName;
        delete base.voice_preset_name;
        delete base["配音音色名称"];
        delete base.voiceProvider;
        delete base["配音服务"];
        delete base.voiceId;
        delete base["配音标识"];
        return base;
      }
      base.voicePresetId = voice.id;
      base.voice_preset_id = voice.id;
      base["配音音色ID"] = voice.id;
      base.voicePresetName = voice.name;
      base.voice_preset_name = voice.name;
      base["配音音色名称"] = voice.name;
      base.voiceProvider = voice.provider;
      base["配音服务"] = voice.provider;
      base.voiceId = voice.voiceId;
      base["配音标识"] = voice.voiceId;
      return base;
    },
    [],
  );

  const bindCharacterVoice = useCallback(
    async (character: WorkspaceCharacter, nextVoiceID: string) => {
      const matchedVoice = nextVoiceID ? voicesByID.get(nextVoiceID) ?? null : null;
      setBindingCharacterID(character.id);
      try {
        const updated = await fetchJSON<WorkspaceCharacter>(`/api/studio/characters/${character.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: character.name,
            title: character.title || character.name,
            visualSpec: buildNextCharacterSpec(character, matchedVoice),
          }),
        });
        onCharactersUpdated?.([updated]);
        toast.success(matchedVoice ? `已为 ${character.name} 绑定音色「${matchedVoice.name}」` : `已清空 ${character.name} 的音色绑定`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "绑定音色失败");
      } finally {
        setBindingCharacterID("");
      }
    },
    [buildNextCharacterSpec, onCharactersUpdated, voicesByID],
  );

  const handleUploadAndCreateVoice = async () => {
    if (!uploadTarget) {
      return;
    }
    if (!uploadVoiceName.trim()) {
      toast.error("请填写音色名称");
      return;
    }
    if (!uploadVoiceFile) {
      toast.error("请先选择本地音频文件");
      return;
    }

    setUploadingVoice(true);
    try {
      const voiceID = `voice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

      const uploadForm = new FormData();
      uploadForm.append("file", uploadVoiceFile, uploadVoiceFile.name);
      uploadForm.append("voiceId", voiceID);
      const uploadResp = await fetch("/api/studio/voices/sample/upload", {
        method: "POST",
        body: uploadForm,
      });
      const uploadPayload = (await uploadResp.json().catch(() => null)) as { error?: string; url?: string } | null;
      if (!uploadResp.ok) {
        throw new Error(uploadPayload?.error || `Request failed (${uploadResp.status})`);
      }
      const sampleAudioUrl = asText(uploadPayload?.url);
      if (!sampleAudioUrl) {
        throw new Error("上传成功但未返回音频地址");
      }

      const createdVoice = await fetchJSON<WorkspaceVoicePreset>(`/api/studio/projects/${projectID}/voices`, {
        method: "POST",
        body: JSON.stringify({
          name: uploadVoiceName.trim(),
          provider: "indextts",
          voiceId: voiceID,
          config: {
            sampleAudioUrl,
            gender: uploadVoiceGender,
          },
          previewText: "",
        }),
      });

      onVoicesUpdated?.([createdVoice]);

      const updatedCharacter = await fetchJSON<WorkspaceCharacter>(`/api/studio/characters/${uploadTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: uploadTarget.name,
          title: uploadTarget.title || uploadTarget.name,
          visualSpec: buildNextCharacterSpec(uploadTarget, createdVoice),
        }),
      });
      onCharactersUpdated?.([updatedCharacter]);

      toast.success(`已创建并绑定音色「${createdVoice.name}」`);
      closeUploadModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "本地上传创建音色失败");
    } finally {
      setUploadingVoice(false);
    }
  };

  const handleOpenUploadForCharacter = (character: WorkspaceCharacter) => {
    setUploadTarget(character);
    setUploadVoiceName(`${character.name} 音色`);
    const spec = asRecord(character.visualSpec);
    setUploadVoiceGender(asText(spec?.["性别"]) || "未知");
    setUploadVoiceFile(null);
    setShowUploadModal(true);
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <section className="rounded-3xl border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100">剧本配音</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
          先在“人物与场景”确认角色后，这里会自动列出人物。你可以从资料库选择现有音色，或直接上传本地音频创建新音色并绑定到角色。
        </p>
        <div className="mt-3 flex items-center gap-3 text-[11px] font-bold text-zinc-500">
          <span>人物 {sortedCharacters.length} 个</span>
          <span>·</span>
          <span>可用音色 {sortedVoices.length} 个</span>
        </div>
      </section>

      {sortedCharacters.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 px-6 py-16 text-center text-zinc-400 dark:border-zinc-800">
          还没有人物，请先在“人物与场景”导入或创建角色
        </div>
      ) : (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {sortedCharacters.map((character) => {
              const assignedVoiceID = readCharacterVoicePresetID(character);
              const assignedVoice = assignedVoiceID ? voicesByID.get(assignedVoiceID) : undefined;
              const assignedVoiceName = assignedVoice?.name || readCharacterVoicePresetName(character) || "未绑定";
              const previewUrl = resolveWorldviewPreviewUrl(character);
              const sampleAudio = assignedVoice ? readVoiceSampleAudioUrl(assignedVoice) : "";

              return (
                <article
                  key={character.id}
                  className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  <div className="flex gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
                      {previewUrl ? (
                        <img src={previewUrl} alt={character.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-400">
                          <Users size={18} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="truncate text-base font-black text-zinc-900 dark:text-zinc-100">{character.name}</h3>
                      <p className="text-xs font-semibold text-zinc-500">当前音色：{assignedVoiceName}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="space-y-1.5">
                      <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">选择资料库音色</label>
                      <select
                        value={assignedVoiceID}
                        onChange={(event) => void bindCharacterVoice(character, event.target.value)}
                        disabled={bindingCharacterID === character.id}
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold outline-none transition-all focus:border-rose-500 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="">不绑定音色</option>
                        {sortedVoices.map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.name} · {voice.provider}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => handleOpenUploadForCharacter(character)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-xs font-bold text-white transition-colors hover:bg-rose-600 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-rose-500"
                        disabled={bindingCharacterID === character.id}
                      >
                        <Upload size={14} />
                        本地上传新音色
                      </button>
                      <LibraryWavePlayer sampleAudio={sampleAudio} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {showUploadModal && uploadTarget ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/35 p-0 backdrop-blur-[2px] animate-in fade-in sm:items-center sm:p-4">
          <div className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 animate-in zoom-in-95 duration-200 sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-8 sm:py-6">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">本地上传新音色</h3>
                <p className="mt-1 text-xs font-medium text-zinc-500">创建后将自动绑定到角色「{uploadTarget.name}」。</p>
              </div>
              <button
                onClick={closeUploadModal}
                className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-900"
                disabled={uploadingVoice}
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <div className="custom-scrollbar flex-1 min-h-0 space-y-5 overflow-y-auto px-4 py-5 sm:px-8 sm:py-8">
              <div className="space-y-1.5">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">音色名称</label>
                <input
                  value={uploadVoiceName}
                  onChange={(event) => setUploadVoiceName(event.target.value)}
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold outline-none transition-all focus:border-rose-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="请输入音色名称"
                />
              </div>

              <div className="space-y-1.5">
                <label className="px-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">音色性别</label>
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-900">
                  {["男", "女", "未知"].map((gender) => (
                    <button
                      key={gender}
                      type="button"
                      onClick={() => setUploadVoiceGender(gender)}
                      className={`h-9 rounded-lg text-xs font-bold transition-all ${
                        uploadVoiceGender === gender
                          ? "bg-white text-rose-600 shadow-sm dark:bg-zinc-800"
                          : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                      }`}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <input
                  ref={uploadFileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(event) => setUploadVoiceFile(event.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => uploadFileInputRef.current?.click()}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white text-sm font-bold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  <Upload size={15} />
                  {uploadVoiceFile ? "重新选择音频文件" : "选择音频文件"}
                </button>
                <p className="text-xs font-medium text-zinc-500">
                  {uploadVoiceFile ? `已选择：${uploadVoiceFile.name}` : "支持 mp3 / wav / m4a 等常见音频格式"}
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:px-8 sm:py-5">
              <button
                onClick={closeUploadModal}
                disabled={uploadingVoice}
                className="w-full rounded-xl border border-zinc-200 py-3 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 sm:flex-1"
              >
                取消
              </button>
              <button
                onClick={() => void handleUploadAndCreateVoice()}
                disabled={uploadingVoice || !uploadVoiceName.trim() || !uploadVoiceFile}
                className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-rose-500 sm:flex-[1.6]"
              >
                {uploadingVoice ? <Loader2 size={18} className="mx-auto animate-spin" /> : "创建并绑定音色"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type StoryboardFilter = "all" | "pending" | "approved";

function readFlexibleText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => readFlexibleText(item))
      .filter(Boolean)
      .join(" / ");
  }
  return "";
}

function readFlexibleFromRecord(record: Record<string, unknown> | null, keys: string[]): string {
  if (!record) {
    return "";
  }
  for (const key of keys) {
    const next = readFlexibleText(record[key]);
    if (next) {
      return next;
    }
  }
  return "";
}

function readShotImageUrl(
  shot: WorkspaceShot,
  spec: Record<string, unknown>,
  visualInfo: Record<string, unknown> | null,
): string {
  const shotRecord = shot as unknown as Record<string, unknown>;
  const direct =
    readFlexibleFromRecord(shotRecord, ["finalImage", "finalImageUrl", "imageUrl", "image", "cover"]) ||
    readFlexibleFromRecord(spec, ["finalImage", "finalImageUrl", "imageUrl", "image", "cover", "previewImageUrl", "preview_image_url"]) ||
    readFlexibleFromRecord(visualInfo, ["finalImage", "finalImageUrl", "imageUrl", "image", "cover"]);
  if (direct) {
    return direct;
  }

  const previewNode = asRecord(spec.preview) || asRecord(visualInfo?.preview);
  const nested = readFlexibleFromRecord(previewNode, ["url", "imageUrl", "previewImageUrl"]);
  if (nested) {
    return nested;
  }
  return shot.finalAsset?.publicUrl || "";
}

function MergedStoryboardTab({
  shots = [],
  approvedShots = [],
  onApprove,
  storyboards = [],
  activeStoryboardId = "",
  onSelectStoryboard,
  onRefreshStoryboard,
  loading = false,
}: {
  shots: WorkspaceShot[];
  approvedShots: number[];
  onApprove: (n: number) => void;
  storyboards?: WorkspaceStoryboard[];
  activeStoryboardId?: string;
  onSelectStoryboard?: (storyboardID: string) => void;
  onRefreshStoryboard?: () => void;
  loading?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StoryboardFilter>("all");
  const [selectedSeqNo, setSelectedSeqNo] = useState<number | null>(null);

  const normalizedShots = useMemo(() => {
    return [...shots]
      .sort((left, right) => left.seqNo - right.seqNo)
      .map((shot) => {
        const spec = asRecord(shot.visualSpec) ?? {};
        const visualInfo =
          asRecord(spec["视觉信息"]) ||
          asRecord(spec.visualInfo) ||
          asRecord(spec["visual_info"]) ||
          asRecord(spec.visual);
        const voiceRole =
          shot.voiceRole ||
          readFlexibleFromRecord(spec, ["配音角色", "voiceRole", "旁白角色", "speaker", "role"]) ||
          "未标注";
        const voiceLine =
          shot.voiceLine ||
          readFlexibleFromRecord(spec, ["配音台词", "voiceLine", "对白", "台词", "旁白"]) ||
          "（该镜头无对白）";
        const sfxHint =
          shot.sfxHint ||
          readFlexibleFromRecord(spec, ["音效建议", "sfxHint", "音效", "soundEffects", "sound_effects"]) ||
          "（未定义）";
        const characterRef = readFlexibleFromRecord(spec, ["人物预设引用", "characterRef", "characterPresetRef", "角色预设引用"]);
        const environmentRef = readFlexibleFromRecord(spec, ["环境预设引用", "environmentRef", "environmentPresetRef", "场景预设引用"]);
        const prompt =
          readFlexibleFromRecord(spec, ["prompt", "画面描述", "description", "镜头描述"]) ||
          readFlexibleFromRecord(visualInfo, ["画面描述", "description"]);
        const mainSubject = readFlexibleFromRecord(visualInfo, ["主体对象", "mainSubject", "main_subject", "subject"]);
        const tone = readFlexibleFromRecord(visualInfo, ["色调氛围", "tone", "mood", "styleTone"]);
        const composition = readFlexibleFromRecord(visualInfo, ["构图视角", "composition", "camera", "cameraAngle"]);
        const environment = readFlexibleFromRecord(visualInfo, ["环境背景", "background", "environment", "setting"]);
        const style = readFlexibleFromRecord(visualInfo, ["角色与风格", "style", "characterStyle", "renderStyle"]);
        const negativePrompt = readFlexibleFromRecord(visualInfo, ["负面提示词", "negativePrompt", "negative_prompt"]);
        const imageUrl = readShotImageUrl(shot, spec, visualInfo);
        const approved = approvedShots.includes(shot.seqNo) || isShotApprovedStatus(shot.status);

        return {
          shot,
          spec,
          visualInfo,
          voiceRole,
          voiceLine,
          sfxHint,
          characterRef,
          environmentRef,
          prompt,
          mainSubject,
          tone,
          composition,
          environment,
          style,
          negativePrompt,
          imageUrl,
          approved,
        };
      });
  }, [shots, approvedShots]);

  const filteredShots = useMemo(() => {
    return normalizedShots.filter((item) => {
      if (filter === "approved" && !item.approved) {
        return false;
      }
      if (filter === "pending" && item.approved) {
        return false;
      }
      if (!query.trim()) {
        return true;
      }
      const keyword = query.trim().toLowerCase();
      return (
        String(item.shot.seqNo).includes(keyword) ||
        item.voiceRole.toLowerCase().includes(keyword) ||
        item.voiceLine.toLowerCase().includes(keyword) ||
        item.sfxHint.toLowerCase().includes(keyword) ||
        item.prompt.toLowerCase().includes(keyword)
      );
    });
  }, [filter, normalizedShots, query]);

  const effectiveSelectedSeqNo =
    selectedSeqNo !== null && filteredShots.some((item) => item.shot.seqNo === selectedSeqNo)
      ? selectedSeqNo
      : (filteredShots[0]?.shot.seqNo ?? null);

  const selectedShot =
    filteredShots.find((item) => item.shot.seqNo === effectiveSelectedSeqNo) ||
    normalizedShots.find((item) => item.shot.seqNo === effectiveSelectedSeqNo) ||
    filteredShots[0] ||
    normalizedShots[0];

  const total = normalizedShots.length;
  const approvedCount = normalizedShots.filter((item) => item.approved).length;
  const pendingCount = Math.max(0, total - approvedCount);
  const progress = total > 0 ? Math.round((approvedCount / total) * 100) : 0;

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-500 sm:space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-3xl sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 sm:text-lg">分镜审查工作台</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-zinc-500">
              <Badge variant="default">{total} 镜头</Badge>
              <Badge variant="success">{approvedCount} 已通过</Badge>
              <Badge variant="accent">{pendingCount} 待处理</Badge>
              <span className="ml-1 font-mono text-zinc-400">进度 {progress}%</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={activeStoryboardId}
              onChange={(event) => onSelectStoryboard?.(event.target.value)}
              className="h-10 min-w-[180px] rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-xs font-bold text-zinc-700 outline-none transition-all focus:border-rose-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              disabled={storyboards.length <= 1 || loading}
            >
              {storyboards.length === 0 ? (
                <option value="">暂无分镜版本</option>
              ) : (
                storyboards.map((storyboard) => (
                  <option key={storyboard.id} value={storyboard.id}>
                    {storyboard.title || `分镜版本 v${storyboard.version || 1}`} · {storyboard.status || "draft"}
                  </option>
                ))
              )}
            </select>
            <Button variant="outline" className="h-10 rounded-xl px-3 text-xs" onClick={() => onRefreshStoryboard?.()} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              刷新
            </Button>
          </div>
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 py-20 text-center text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/40 sm:rounded-3xl sm:py-28">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
            <LayoutList size={24} />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.24em]">分镜尚未就绪</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-3xl sm:p-4">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索镜头号/台词/音效"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-xs font-bold text-zinc-700 outline-none transition-all focus:border-rose-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-900">
              {([
                { id: "all", label: "全部", count: total },
                { id: "pending", label: "待审", count: pendingCount },
                { id: "approved", label: "通过", count: approvedCount },
              ] as Array<{ id: StoryboardFilter; label: string; count: number }>).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`h-9 rounded-lg text-[11px] font-black transition-all ${
                    filter === item.id
                      ? "bg-white text-rose-600 shadow-sm dark:bg-zinc-800"
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {item.label} · {item.count}
                </button>
              ))}
            </div>

            <div className="custom-scrollbar mt-3 max-h-[58vh] space-y-2 overflow-y-auto pr-1">
              {filteredShots.map((item) => {
                const selected = item.shot.seqNo === selectedShot?.shot.seqNo;
                return (
                  <button
                    key={item.shot.id}
                    type="button"
                    onClick={() => setSelectedSeqNo(item.shot.seqNo)}
                    className={`w-full rounded-xl border p-2 text-left transition-all sm:p-3 ${
                      selected
                        ? "border-rose-400 bg-rose-50/80 shadow-sm dark:border-rose-500/60 dark:bg-rose-500/10"
                        : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 text-zinc-300 dark:bg-zinc-800">
                        {item.imageUrl ? <img src={item.imageUrl} alt={`shot-${item.shot.seqNo}`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><Film size={18} /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-black text-zinc-700 dark:text-zinc-200">#{String(item.shot.seqNo).padStart(3, "0")}</span>
                          {item.approved ? <CheckCircle2 size={14} className="shrink-0 text-emerald-500" /> : <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] font-bold text-zinc-700 dark:text-zinc-200">{item.voiceRole}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500 dark:text-zinc-400">{item.voiceLine}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredShots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-xs font-bold text-zinc-400 dark:border-zinc-700">
                  没有匹配结果
                </div>
              ) : null}
            </div>
          </aside>

          <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-3xl sm:p-6">
            {selectedShot ? (
              <div className="space-y-4 sm:space-y-6">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-3">
                    <div className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-100 text-zinc-300 shadow-inner sm:rounded-[1.75rem]">
                      {selectedShot.imageUrl ? (
                        <img src={selectedShot.imageUrl} alt={`镜头 ${selectedShot.shot.seqNo}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                          <Film size={34} />
                          <span className="text-xs font-black uppercase tracking-widest">暂无成片图</span>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3 text-white sm:p-4">
                        <div>
                          <p className="font-mono text-xs font-black">镜头 #{String(selectedShot.shot.seqNo).padStart(3, "0")}</p>
                          <p className="mt-0.5 text-[11px] font-bold text-white/80">{selectedShot.voiceRole}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onApprove(selectedShot.shot.seqNo)}
                          className={`inline-flex h-9 items-center justify-center gap-1 rounded-full px-3 text-xs font-black transition-colors ${
                            selectedShot.approved ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-white/90 text-zinc-900 hover:bg-rose-500 hover:text-white"
                          }`}
                        >
                          <Check size={14} />
                          {selectedShot.approved ? "已通过" : "标记通过"}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl sm:p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">配音台词</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-relaxed italic text-zinc-800 dark:text-zinc-100 sm:text-base">
                        “{selectedShot.voiceLine}”
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:gap-3">
                    {[
                      { label: "音效建议", value: selectedShot.sfxHint },
                      { label: "人物预设引用", value: selectedShot.characterRef || "（未定义）" },
                      { label: "环境预设引用", value: selectedShot.environmentRef || "（未定义）" },
                      { label: "镜头状态", value: selectedShot.shot.status || "draft" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl">
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{item.label}</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs font-bold leading-relaxed text-zinc-700 dark:text-zinc-200">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "主体对象", value: selectedShot.mainSubject || "（未定义）" },
                    { label: "构图视角", value: selectedShot.composition || "（未定义）" },
                    { label: "环境背景", value: selectedShot.environment || "（未定义）" },
                    { label: "色调氛围", value: selectedShot.tone || "（未定义）" },
                    { label: "角色与风格", value: selectedShot.style || "（未定义）" },
                    { label: "画面描述", value: selectedShot.prompt || "（未定义）" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl sm:p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{item.label}</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-relaxed text-zinc-700 dark:text-zinc-200">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">负面提示词</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs font-semibold leading-relaxed text-zinc-700 dark:text-zinc-200">
                    {selectedShot.negativePrompt || "（未定义）"}
                  </p>
                </div>

                <details className="group rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl sm:p-4">
                  <summary className="cursor-pointer list-none text-[11px] font-black uppercase tracking-widest text-zinc-500 transition-colors group-open:text-rose-600">
                    查看镜头原始 JSON
                  </summary>
                  <JsonCodePreview value={JSON.stringify(selectedShot.spec, null, 2)} className="mt-3 max-h-64 rounded-xl border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900" />
                </details>
              </div>
            ) : (
              <div className="py-24 text-center text-zinc-400">
                <p className="text-xs font-black uppercase tracking-widest">请选择一个镜头查看详情</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ExportTab() {
  return (
    <div className="w-full py-20 text-center animate-in zoom-in-95 duration-700 sm:py-32">
      <div className="mx-auto w-full max-w-4xl px-2">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 animate-bounce sm:mb-8 sm:h-24 sm:w-24"><CheckCircle size={42} className="sm:h-12 sm:w-12" /></div>
        <h2 className="mb-3 text-3xl font-black text-zinc-900 dark:text-zinc-100 sm:mb-4 sm:text-4xl">资产已就绪</h2>
        <p className="mb-8 px-2 text-zinc-500 sm:mb-12">剧本、声效与视觉画面已完成对齐，现在可以导出您的作品。</p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
           <Button className="h-12 rounded-xl px-6 text-xs font-black uppercase tracking-widest sm:h-14 sm:rounded-2xl sm:px-8"><Download size={18} /> 导出剪辑工程</Button>
           <Button variant="outline" className="h-12 rounded-xl px-6 text-xs font-black uppercase tracking-widest sm:h-14 sm:rounded-2xl sm:px-8"><Film size={18} /> 提交 4K 渲染</Button>
        </div>
      </div>
    </div>
  );
}

// --- 流水线主容器 ---

function ProjectPipeline({ project, activeStep, setActiveStep, onBack, onUpdateProject, ...props }: {
  project: WorkspaceProject;
  activeStep: PipelineStepID;
  setActiveStep: (s: PipelineStepID) => void;
  onBack: () => void;
  onUpdateProject?: (data: Partial<WorkspaceProject>) => Promise<void>;
  characters?: WorkspaceCharacter[];
  environments?: WorkspaceEnvironment[];
  styles?: WorkspaceStylePreset[];
  voices?: WorkspaceVoicePreset[];
  storyboards?: WorkspaceStoryboard[];
  shots?: WorkspaceShot[];
  activeStoryboardId?: string;
  onSelectStoryboard?: (storyboardID: string) => void;
  onRefreshStoryboard?: () => void;
  storyboardLoading?: boolean;
  approvedShots?: number[];
  onApprove?: (n: number) => void;
  onWorldviewImported?: (payload: { characters: WorkspaceCharacter[]; environments: WorkspaceEnvironment[] }) => void;
  onCharactersUpdated?: (items: WorkspaceCharacter[]) => void;
  onVoicesUpdated?: (items: WorkspaceVoicePreset[]) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const contentScrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeStep, project.id]);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-col bg-white px-3 dark:bg-transparent sm:px-8">
      <header className="relative z-20 flex shrink-0 flex-col gap-3 border-b border-zinc-100 bg-white py-3 shadow-[0_1px_0_0_rgba(24,24,27,0.04)] dark:border-zinc-800/50 dark:bg-zinc-950 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:py-0">
        {/* 左侧：面包屑语境 */}
        <div className="flex items-center gap-2 lg:min-w-[300px]">
          <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" title="返回项目列表"><ChevronRight className="rotate-180" size={20} /></button>
          <h1 className="text-base font-black tracking-tight text-zinc-900 dark:text-zinc-100 max-w-[140px] truncate sm:max-w-[240px]">{project.name}</h1>
        </div>

        {/* 中间：创作步骤导航 */}
        <nav className="flex flex-1 items-center justify-center gap-1 overflow-x-auto no-scrollbar py-1">
          {PIPELINE_STEPS.map(step => (
            <button key={step.id} onClick={() => setActiveStep(step.id)} className={`relative shrink-0 flex items-center gap-2 px-4 py-2 text-[13px] font-bold transition-all ${activeStep === step.id ? "text-rose-600" : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"}`}>
              <step.icon size={16} />
              <span>{step.label}</span>
              {activeStep === step.id && <div className="absolute bottom-0 left-0 h-0.5 w-full bg-rose-600 animate-in slide-in-from-bottom-1 duration-300" />}
            </button>
          ))}
        </nav>

        {/* 右侧：动作按钮 */}
        <div className="flex items-center justify-end gap-2 shrink-0 lg:min-w-[300px]">
           <button onClick={() => setShowSettings(true)} className="flex h-9 items-center justify-center gap-2 rounded-full border border-zinc-200 px-4 text-xs font-bold text-zinc-600 transition-colors hover:bg-zinc-50 hover:text-rose-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900">
             <Settings size={14} /> <span className="hidden sm:inline">项目设置</span>
           </button>
           <button className="flex h-9 items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 text-xs font-bold text-white transition-all hover:bg-rose-600 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-rose-500 dark:hover:text-white"><Save size={14} /> <span className="hidden sm:inline">保存进度</span></button>
        </div>
      </header>
      
      <main ref={contentScrollRef} className="custom-scrollbar flex-1 min-h-0 overflow-y-auto py-6 sm:py-10">
        <div className="w-full">
          {activeStep === "script" && <ScriptTab project={project} onUpdate={onUpdateProject} />}
          {activeStep === "style" && <StyleTab styles={props.styles || []} project={project} onUpdateProject={onUpdateProject} />}
          {activeStep === "worldview" && (
            <WorldviewView
              project={project}
              characters={props.characters || []}
              environments={props.environments || []}
              onImported={props.onWorldviewImported}
            />
          )}
          {activeStep === "audio" && (
            <AudioTab
              projectID={project.id}
              characters={props.characters || []}
              voices={props.voices || []}
              onCharactersUpdated={props.onCharactersUpdated}
              onVoicesUpdated={props.onVoicesUpdated}
            />
          )}
          {activeStep === "storyboard" && (
            <MergedStoryboardTab
              shots={props.shots || []}
              approvedShots={props.approvedShots || []}
              onApprove={props.onApprove || (() => {})}
              storyboards={props.storyboards || []}
              activeStoryboardId={props.activeStoryboardId || ""}
              onSelectStoryboard={props.onSelectStoryboard}
              onRefreshStoryboard={props.onRefreshStoryboard}
              loading={props.storyboardLoading || false}
            />
          )}
          {activeStep === "export" && <ExportTab />}
        </div>
      </main>

      {showSettings && onUpdateProject && (
        <ProjectSettingsModal 
          project={project} 
          onClose={() => setShowSettings(false)} 
          onUpdate={onUpdateProject} 
        />
      )}
    </div>
  );
}

// --- 最终导出面板 ---

export function StudioWorkbenchPanel({
  ownerMe,
  ownerDirectory = [],
}: {
  ownerMe: WorkspaceOwnerProfile;
  ownerDirectory?: WorkspaceOwnerProfile[];
}) {
  const currentUserID = ownerMe.id;
  const ownerProfiles = useMemo<OwnerProfileMap>(() => {
    console.log("[StudioWorkbench] Building ownerProfiles from directory:", ownerDirectory.length, "items");
    const next: OwnerProfileMap = {};
    ownerDirectory.forEach((item) => {
      if (item.id) {
        next[item.id] = item;
      }
    });
    if (ownerMe.id) {
      next[ownerMe.id] = ownerMe;
    }
    return next;
  }, [ownerDirectory, ownerMe]);

  const [view, setView] = useState<"dashboard" | "editor">("dashboard");
  const [loading, setLoading] = useState(true);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [syncIssue, setSyncIssue] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const [projects, setProjects] = useState<ProjectCardModel[]>([]);
  const [project, setProject] = useState<WorkspaceProject | null>(null);
  const [stylePresets, setStylePresets] = useState<WorkspaceStylePreset[]>([]);
  const [characters, setCharacters] = useState<WorkspaceCharacter[]>([]);
  const [environments, setEnvironments] = useState<WorkspaceEnvironment[]>([]);
  const [voicePresets, setVoicePresets] = useState<WorkspaceVoicePreset[]>([]);
  const [storyboards, setStoryboards] = useState<WorkspaceStoryboard[] | null>(null);
  const [activeStoryboardID, setActiveStoryboardID] = useState("");
  const [storyboardLoading, setStoryboardLoading] = useState(false);
  const [shots, setShots] = useState<WorkspaceShot[] | null>(null);
  const [approvedShots, setApprovedShots] = useState<number[]>([]);

  const [activeStep, setActiveStep] = useState<PipelineStepID>("script");
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; action: () => Promise<void> | void } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [newProjName, setNewProjName] = useState("");
  const [newProjVis, setNewProjVis] = useState<WorkspaceVisibility>("private");

  const applyShotPayload = useCallback((items: WorkspaceShot[]) => {
    const ordered = [...items].sort((left, right) => left.seqNo - right.seqNo);
    setShots(ordered);
    setApprovedShots(ordered.filter((shot) => isShotApprovedStatus(shot.status)).map((shot) => shot.seqNo));
  }, []);

  const loadShotsByStoryboardID = useCallback(
    async (storyboardID: string, opts?: { silent?: boolean }) => {
      if (!storyboardID) {
        setShots([]);
        setApprovedShots([]);
        return;
      }
      setStoryboardLoading(true);
      try {
        const payload = await fetchJSON<WorkspaceShotsResponse>(`/api/studio/storyboards/${storyboardID}/shots`);
        applyShotPayload(payload.items ?? []);
      } catch (error) {
        setShots([]);
        setApprovedShots([]);
        if (!opts?.silent) {
          toast.error(error instanceof Error ? error.message : "镜头加载失败");
        }
      } finally {
        setStoryboardLoading(false);
      }
    },
    [applyShotPayload],
  );

  const loadStoryboardReview = useCallback(
    async (projectID: string, preferredStoryboardID?: string, opts?: { silent?: boolean }) => {
      if (!projectID) {
        setStoryboards([]);
        setActiveStoryboardID("");
        setShots([]);
        setApprovedShots([]);
        return;
      }

      setStoryboardLoading(true);
      try {
        const payload = await fetchJSON<WorkspaceStoryboardsResponse>(`/api/studio/projects/${projectID}/storyboards`);
        const orderedStoryboards = sortStoryboards(payload.items ?? []);
        setStoryboards(orderedStoryboards);

        const target =
          orderedStoryboards.find((item) => item.id === preferredStoryboardID) ||
          orderedStoryboards[0];

        if (!target?.id) {
          setActiveStoryboardID("");
          setShots([]);
          setApprovedShots([]);
          return;
        }

        setActiveStoryboardID(target.id);
        const shotsPayload = await fetchJSON<WorkspaceShotsResponse>(`/api/studio/storyboards/${target.id}/shots`);
        applyShotPayload(shotsPayload.items ?? []);
      } catch (error) {
        setStoryboards([]);
        setActiveStoryboardID("");
        setShots([]);
        setApprovedShots([]);
        if (!opts?.silent) {
          toast.error(error instanceof Error ? error.message : "分镜加载失败");
        }
      } finally {
        setStoryboardLoading(false);
      }
    },
    [applyShotPayload],
  );

  const handleSelectStoryboard = useCallback(
    (storyboardID: string) => {
      if (!storyboardID || storyboardID === activeStoryboardID) {
        return;
      }
      setActiveStoryboardID(storyboardID);
      void loadShotsByStoryboardID(storyboardID);
    },
    [activeStoryboardID, loadShotsByStoryboardID],
  );

  const handleRefreshStoryboard = useCallback(() => {
    if (!project?.id) {
      return;
    }
    void loadStoryboardReview(project.id, activeStoryboardID || undefined);
  }, [project?.id, activeStoryboardID, loadStoryboardReview]);

  const syncData = useCallback(async (signal?: AbortSignal) => {
    const loadCards = async () => {
      try {
        console.log("[StudioWorkbench] Fetching projects...");
        const payload = await fetchJSON<unknown>("/api/studio/projects", { signal });
        const projectItems = extractWorkspaceProjects(payload).filter((projectItem) => {
          const isSystemLibrary =
            Array.isArray(projectItem.tags) &&
            projectItem.tags.includes(SYSTEM_LIBRARY_TAG) &&
            (projectItem.name || "").trim() === SYSTEM_LIBRARY_NAME;
          return !isSystemLibrary;
        });
        console.log("[StudioWorkbench] Projects found:", projectItems.length);

        const cards = await Promise.allSettled(
          projectItems.map(async (projectItem) => {
            const [detail, library] = await Promise.all([
              fetchJSON<WorkspaceProjectDetail>(`/api/studio/projects/${projectItem.id}`, { signal }).catch(() => undefined),
              fetchJSON<WorkspaceProjectLibrary>(`/api/studio/projects/${projectItem.id}/library`, { signal }).catch(() => undefined),
            ]);
            return mapProjectCard(projectItem, ownerMe, ownerProfiles, detail, library);
          }),
        );

        if (signal?.aborted) return;

        const nextProjects: ProjectCardModel[] = cards.map((item, index) => {
          if (item.status === "fulfilled") {
            return item.value;
          }
          const fallback = projectItems[index];
          console.warn("[StudioWorkbench] Detail fetch failed for project:", fallback.id, item.reason);
          return mapProjectCard(fallback, ownerMe, ownerProfiles);
        });
        setProjects(nextProjects);
        setSyncIssue("");
      } catch (err) {
        if (signal?.aborted) return;
        console.error("[StudioWorkbench] Failed to load cards:", err);
        throw err;
      }
    };

    setLoading(true);
    try {
      await loadCards();
    } catch (error) {
      if (signal?.aborted) return;
      
      // Handle unauthorized errors with an improved retry/refresh cycle
      if (isUnauthorizedLike(error)) {
        console.log("[StudioWorkbench] Unauthorized access detected, attempting background recovery...");
        
        // Try up to 3 times with progressive backoff to wait for NextAuth middleware to rotate the token
        for (const delay of [400, 1200, 2500]) {
          await wait(delay);
          if (signal?.aborted) return;
          
          try {
            console.log(`[StudioWorkbench] Retrying data sync (after ${delay}ms)...`);
            await loadCards();
            return; // Success!
          } catch (retryError) {
            if (!isUnauthorizedLike(retryError)) {
              throw retryError; // Not an auth error anymore, escalate to general error handler
            }
            // Still unauthorized, check if it's a fatal session state
            const probe = await readSessionProbe();
            if (!probe?.user || fatalSessionErrors.has(probe.error ?? "")) {
              console.warn("[StudioWorkbench] Session probe confirmed fatal auth error:", probe?.error);
              break; // Stop retrying, it's really expired
            }
            // Otherwise, keep trying until we run out of backoff steps
          }
        }

        // If we reach here, it's likely a real expiration
        const shouldRedirect = await shouldRedirectToLoginOnUnauthorized();
        if (shouldRedirect) {
          toast.error("登录态已失效，请重新登录");
          setSyncIssue("登录态已失效，请重新登录。");
        } else {
          setSyncIssue("会话刷新中，请稍后重试同步。");
          toast.error("会话刷新中，请稍后重试");
        }
        return;
      }

      if (isForbiddenLike(error)) {
        setSyncIssue("当前账号缺少创作工作台访问权限。");
        return;
      }
      if (isServiceUnavailableLike(error)) {
        setSyncIssue("创作服务暂不可用，请稍后重试。");
        return;
      }
      setSyncIssue(error instanceof Error ? `数据同步失败：${error.message}` : "数据同步失败，请稍后重试。");
      toast.error("数据同步失败");
    }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [ownerMe, ownerProfiles]);

  useEffect(() => {
    const controller = new AbortController();
    void syncData(controller.signal);

    const handleOnline = () => {
      console.log("[StudioWorkbench] Network back online, re-syncing...");
      setSyncIssue("");
      void syncData(controller.signal);
    };

    window.addEventListener("online", handleOnline);
    return () => {
      controller.abort();
      window.removeEventListener("online", handleOnline);
    };
  }, [syncData]);

  useEffect(() => {
    if (!project?.id || activeStep !== "storyboard" || storyboardLoading) {
      return;
    }
    // Only hydrate if we haven't even attempted to load for this project (indicated by null)
    const shouldHydrate = storyboards === null || (activeStoryboardID && shots === null);
    if (shouldHydrate) {
      void loadStoryboardReview(project.id, activeStoryboardID || undefined, { silent: true });
    }
  }, [project?.id, activeStep, storyboardLoading, storyboards, activeStoryboardID, shots, loadStoryboardReview]);

  const handleOpenProject = async (id: string) => {
    setLoadingEditor(true);
    setStoryboards(null);
    setActiveStoryboardID("");
    setShots(null);
    setApprovedShots([]);
    try {
      const detail = await fetchJSON<WorkspaceProjectDetail>(`/api/studio/projects/${id}`);
      let library: WorkspaceProjectLibrary = { prompts: [], styles: [], characters: [], environments: [], voices: [] };
      try { library = await fetchJSON<WorkspaceProjectLibrary>(`/api/studio/projects/${id}/library`); } catch {}
      let mergedStyles = library.styles ?? [];
      let mergedVoices = library.voices ?? [];
      try {
        const globalProjectsPayload = await fetchJSON<unknown>("/api/studio/projects");
        const globalProject = extractWorkspaceProjects(globalProjectsPayload).find(
          (projectItem) =>
            projectItem.id !== id &&
            Array.isArray(projectItem.tags) &&
            projectItem.tags.includes(SYSTEM_LIBRARY_TAG) &&
            (projectItem.name || "").trim() === SYSTEM_LIBRARY_NAME,
        );
        if (globalProject) {
          const globalLibrary = await fetchJSON<WorkspaceProjectLibrary>(`/api/studio/projects/${globalProject.id}/library`);
          mergedStyles = mergeStylePresets(library.styles ?? [], globalLibrary.styles ?? []);
          mergedVoices = mergeByID(library.voices ?? [], globalLibrary.voices ?? []);
        }
      } catch {
        mergedStyles = library.styles ?? [];
        mergedVoices = library.voices ?? [];
      }
      setProject(detail.project);
      setStylePresets(mergedStyles);
      setCharacters(detail.characters?.length ? detail.characters : (library.characters ?? []));
      setEnvironments(detail.environments?.length ? detail.environments : (library.environments ?? []));
      setVoicePresets(mergedVoices);
      await loadStoryboardReview(id, undefined, { silent: true });
      setActiveStep("script");
      setView("editor");
    } catch { toast.error("打开项目失败"); }
    finally { setLoadingEditor(false); }
  };

  const handleUpdateProject = async (data: Partial<WorkspaceProject>) => {
    if (!project) return;
    try {
      const updated = await fetchJSON<WorkspaceProject>(`/api/studio/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      setProject(updated);
      await syncData();
    } catch {
      throw new Error("Failed to update project");
    }
  };

  const handleCreateProject = async () => {
    if (!newProjName.trim()) return;
    setLoadingEditor(true);
    try {
      const p = await fetchJSON<WorkspaceProject>("/api/studio/projects", {
        method: "POST",
        body: JSON.stringify({ name: newProjName.trim(), visibility: newProjVis }),
      });
      setProjects((prev) => [mapProjectCard(p, ownerMe, ownerProfiles), ...prev.filter((item) => item.id !== p.id)]);
      setShowCreateModal(false);
      setNewProjName("");
      await handleOpenProject(p.id);
      toast.success("新项目已创建");
    } catch { toast.error("创建失败"); setLoadingEditor(false); }
  };

  const handleDeleteProject = useCallback((projectItem: ProjectCardModel) => {
    if (projectItem.ownerId !== currentUserID) {
      toast.error("仅归属者可以删除项目");
      return;
    }
    setConfirmDialog({
      title: `确认删除项目 「${projectItem.title}」？`,
      action: async () => {
        await fetchJSON<void>(`/api/studio/projects/${projectItem.id}`, { method: "DELETE" });
        toast.success("项目已删除");
        await syncData();
      },
    });
  }, [currentUserID, syncData]);

  const handleWorldviewImported = useCallback(
    (payload: { characters: WorkspaceCharacter[]; environments: WorkspaceEnvironment[] }) => {
      if (payload.characters.length > 0) {
        setCharacters((prev) => mergeByID(prev, payload.characters));
      }
      if (payload.environments.length > 0) {
        setEnvironments((prev) => mergeByID(prev, payload.environments));
      }
      void syncData();
    },
    [syncData],
  );

  const handleCharactersUpdated = useCallback((items: WorkspaceCharacter[]) => {
    if (items.length === 0) {
      return;
    }
    setCharacters((prev) => mergeByID(prev, items));
  }, []);

  const handleVoicesUpdated = useCallback((items: WorkspaceVoicePreset[]) => {
    if (items.length === 0) {
      return;
    }
    setVoicePresets((prev) => mergeByID(prev, items));
  }, []);

  if (view === "dashboard") return (
    <div className="relative h-full min-h-0 w-full">
      <MainDashboard 
        projects={projects} 
        loading={loading} 
        onOpenProject={handleOpenProject} 
        onShowCreateForm={() => setShowCreateModal(true)} 
        onDeleteProject={handleDeleteProject} 
        currentUserID={currentUserID} 
        syncIssue={syncIssue}
        onRetry={() => void syncData()}
      />
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 backdrop-blur-[2px] animate-in fade-in sm:items-center sm:p-4">
           <div className="flex h-[100dvh] w-full flex-col overflow-hidden rounded-none border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 animate-in zoom-in-95 duration-200 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-8 sm:py-6">
                 <div>
                   <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">开启新创意</h3>
                   <p className="mt-1 text-xs font-medium text-zinc-500">先创建项目基础信息，后续流程可在项目内继续配置。</p>
                 </div>
                 <button onClick={() => setShowCreateModal(false)} className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-900"><Plus size={24} className="rotate-45" /></button>
              </div>
              <div className="custom-scrollbar flex-1 min-h-0 space-y-6 overflow-y-auto px-4 py-5 sm:space-y-8 sm:px-8 sm:py-8">
                 <FormInput label="项目名称" value={newProjName} onChange={setNewProjName} placeholder="请输入项目名称" />
                 <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">可见性设置</label>
                    <select value={newProjVis} onChange={e => setNewProjVis(e.target.value as WorkspaceVisibility)} className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold outline-none focus:border-rose-500 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900">
                       <option value="private">仅自己可见（私有）</option>
                       <option value="public">所有成员可见（公开）</option>
                    </select>
                 </div>
              </div>
              <div className="flex flex-col-reverse gap-3 border-t border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:px-8 sm:py-5">
                 <button onClick={() => setShowCreateModal(false)} className="w-full rounded-xl border border-zinc-200 py-3 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 sm:flex-1">取消</button>
                 <button onClick={handleCreateProject} disabled={!newProjName.trim() || loadingEditor} className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-rose-500 sm:flex-[1.6]">{loadingEditor ? <Loader2 size={18} className="mx-auto animate-spin" /> : "创建并进入项目"}</button>
              </div>
           </div>
        </div>
      )}
      {confirmDialog && (
        <ConfirmModal
          open={!!confirmDialog}
          title={confirmDialog.title}
          confirmText="确认删除"
          danger
          loading={confirmLoading}
          onCancel={() => { if (!confirmLoading) setConfirmDialog(null); }}
          onConfirm={() => {
            if (!confirmDialog || confirmLoading) return;
            setConfirmLoading(true);
            void Promise.resolve(confirmDialog.action())
              .catch(() => {
                toast.error("删除失败，请稍后重试");
              })
              .finally(() => {
                setConfirmLoading(false);
                setConfirmDialog(null);
              });
          }}
        />
      )}
    </div>
  );

  if (loadingEditor) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-rose-500" /></div>;

  if (view === "editor" && project) {
    return (
      <ProjectPipeline
        project={project}
        activeStep={activeStep}
        setActiveStep={setActiveStep}
        onBack={() => {
          setView("dashboard");
          void syncData();
        }}
        onUpdateProject={handleUpdateProject}
        styles={stylePresets}
        characters={characters}
        environments={environments}
        voices={voicePresets}
        storyboards={storyboards || []}
        shots={shots || []}
        activeStoryboardId={activeStoryboardID}
        onSelectStoryboard={handleSelectStoryboard}
        onRefreshStoryboard={handleRefreshStoryboard}
        storyboardLoading={storyboardLoading}
        approvedShots={approvedShots}
        onApprove={(n) => setApprovedShots((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n]))}
        onWorldviewImported={handleWorldviewImported}
        onCharactersUpdated={handleCharactersUpdated}
        onVoicesUpdated={handleVoicesUpdated}
      />
    );
  }

  return null;
}
