"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  Palette,
  Users,
  Mic,
  MapPin,
  Search,
  Copy,
  Download,
  Eye,
  Save,
  Upload,
  Image as ImageIcon,
  Link2,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import type {
  WorkspaceCharacter,
  WorkspaceEnvironment,
  WorkspaceProject,
  WorkspaceProjectLibrary,
  WorkspacePromptTemplate,
  WorkspaceStylePreset,
  WorkspaceVoicePreset,
} from "@/types/studio";

// --- Types & Interfaces ---

type AssetType = "prompts" | "styles" | "characters" | "environments" | "voices";

type ResourceWithProject<T> = T & {
  projectId: string;
  publisherName: string;
  publisherAvatar: string;
  publishedAt: string;
};

type LibraryAggregate = {
  prompts: Array<ResourceWithProject<WorkspacePromptTemplate>>;
  styles: Array<ResourceWithProject<WorkspaceStylePreset>>;
  characters: Array<ResourceWithProject<WorkspaceCharacter>>;
  environments: Array<ResourceWithProject<WorkspaceEnvironment>>;
  voices: Array<ResourceWithProject<WorkspaceVoicePreset>>;
};

type ProjectLibraryBundle = {
  project: WorkspaceProject;
  library: WorkspaceProjectLibrary;
};

type PromptResource = ResourceWithProject<WorkspacePromptTemplate>;
type StyleResource = ResourceWithProject<WorkspaceStylePreset>;
type CharacterResource = ResourceWithProject<WorkspaceCharacter>;
type EnvironmentResource = ResourceWithProject<WorkspaceEnvironment>;
type VoiceResource = ResourceWithProject<WorkspaceVoicePreset>;

type PromptDraft = { title: string; content: string };
type StyleDraft = { name: string; content: string };
type CharacterDraft = { name: string; gender: string };
type EnvironmentDraft = { name: string };
type VoiceDraft = { name: string; gender: string };

type GenerationProvider = "gemini" | "ollama";
type GeminiThinkingLevel = "minimal" | "low" | "medium" | "high";
type OllamaThinkMode = "none" | "boolean" | "string";

type ModelProviderCatalog = {
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

type ModelsCatalogResponse = {
  providers: {
    gemini: ModelProviderCatalog;
    ollama: ModelProviderCatalog;
  };
  warnings: string[];
  warningsByProvider?: Partial<Record<GenerationProvider, string>>;
};

type AssetMeta = {
  label: string;
  mode: "文本" | "图片" | "音频";
  icon: React.ElementType;
  createHint: string;
  canDelete: boolean;
};

// --- Constants ---

const GENDER_SPEC_KEY = "性别";
const SYSTEM_LIBRARY_TAG = "__system_global_library__";
const SYSTEM_LIBRARY_NAME = "团队全局资料库";

const ASSET_META: Record<AssetType, AssetMeta> = {
  prompts: { label: "提示词库", mode: "文本", icon: Sparkles, createHint: "用于文案、脚本、镜头提示词模板。", canDelete: true },
  styles: { label: "艺术风格", mode: "文本", icon: Palette, createHint: "保存可复用的风格描述与关键词。", canDelete: true },
  characters: { label: "角色视图", mode: "图片", icon: Users, createHint: "保存角色设定与性别属性。", canDelete: true },
  environments: { label: "场景素材", mode: "图片", icon: MapPin, createHint: "保存场景素材设定。", canDelete: true },
  voices: { label: "配音音色", mode: "音频", icon: Mic, createHint: "保存配音音色设定。", canDelete: true },
};

const STYLE_META_KEYS = new Set([
  "previewImageUrl", "preview_image_url", "coverImageUrl", "imageUrl", "url",
  "preview", "previewSource", "previewPrompt", "previewUpdatedAt",
  "previewModel", "previewResult", "previewError", GENDER_SPEC_KEY
]);

const STYLE_LEGACY_TEXT_KEYS = ["content", "prompt", "styleJson", "json", "summary", "description", "style"];
const STYLE_LEGACY_TEXT_KEY_SET = new Set(STYLE_LEGACY_TEXT_KEYS);
const DEFAULT_GEMINI_TEXT_MODELS = ["gemini-3.1-pro-preview", "gemini-3-flash-preview"];
const DEFAULT_GEMINI_IMAGE_MODELS = ["gemini-3-pro-image-preview", "gemini-3.1-flash-image-preview"];
const DEFAULT_OLLAMA_TEXT_MODELS = ["qwen3:latest"];

// --- Common Helper Functions ---

const asString = (v: unknown) => (typeof v === "string" ? v : "");

function buildNotionistsAvatar(seed: string, backgroundColor = "f4f4f5") {
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${backgroundColor}`;
}

function formatPublishDate(raw?: string) {
  if (!raw) return "刚刚";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatAudioDuration(seconds?: number | null) {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const safe = Math.floor(seconds);
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function getStylePreviewUrl(style: WorkspaceStylePreset) {
  const spec = (style.spec ?? {}) as Record<string, unknown>;
  return asString(spec.previewImageUrl) || asString(spec.preview_image_url) || asString(spec.coverImageUrl) || "";
}

function parseLooseJSONObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string") return null;
  let current: unknown = raw.trim();
  if (!current) return null;
  for (let i = 0; i < 2; i += 1) {
    if (typeof current !== "string") break;
    try {
      current = JSON.parse(current);
    } catch {
      return null;
    }
  }
  return current && typeof current === "object" && !Array.isArray(current)
    ? (current as Record<string, unknown>)
    : null;
}

function normalizeEditableSpec(rawSpec: Record<string, unknown> | undefined) {
  const filtered = (filterInternalKeys((rawSpec ?? {}) as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  let usedLegacyObject = false;

  for (const key of STYLE_LEGACY_TEXT_KEYS) {
    const parsed = parseLooseJSONObject(filtered[key]);
    if (parsed) {
      Object.assign(normalized, parsed);
      usedLegacyObject = true;
    }
  }

  for (const [key, value] of Object.entries(filtered)) {
    if (STYLE_LEGACY_TEXT_KEY_SET.has(key)) {
      if (!usedLegacyObject && typeof value === "string" && value.trim()) {
        normalized[key] = value;
      }
      continue;
    }
    normalized[key] = value;
  }

  return normalized;
}

function buildStyleSpecEditorValue(rawSpec: Record<string, unknown> | undefined) {
  return JSON.stringify(normalizeEditableSpec(rawSpec), null, 2);
}

function getVisualDescription(item: { visualSpec?: Record<string, unknown> }) {
  const vs = item.visualSpec ?? {};
  return asString(vs["画面描述"]) || asString(vs.description) || "";
}

function getReferenceMedia(item: { visualSpec?: Record<string, unknown> }) {
  const vs = item.visualSpec ?? {};
  const ref = vs["参考图"];
  return typeof ref === "string" ? ref : Array.isArray(ref) ? asString(ref[0]) : "";
}

function normalizeVoiceGenderLabel(raw: string) {
  const v = raw.trim().toLowerCase();
  if (["male", "man", "男"].includes(v)) return "男";
  if (["female", "woman", "女"].includes(v)) return "女";
  return "未知";
}

function getVoiceSampleAudioUrl(voice: WorkspaceVoicePreset | VoiceResource) {
  const config = (voice.config ?? {}) as Record<string, unknown>;
  return (
    asString(config.sampleAudioUrl) ||
    asString(config.sample_audio_url) ||
    asString(config.audioUrl) ||
    ""
  );
}

function resolveWaveformAudioUrl(rawUrl: string) {
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

function filterInternalKeys(obj: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!obj) return null;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!STYLE_META_KEYS.has(k)) next[k] = v;
  }
  return next;
}

function highlightJson(value: string): string {
  const escaped = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(/("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(?=\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    if (match.startsWith("\"") && match.endsWith("\"")) return /:$/.test(match) ? `<span class="text-indigo-500">${match}</span>` : `<span class="text-emerald-600">${match}</span>`;
    if (["true", "false"].includes(match)) return `<span class="text-orange-500">${match}</span>`;
    return `<span class="text-rose-500">${match}</span>`;
  });
}

function buildDefaultModelsCatalog(): ModelsCatalogResponse {
  return {
    providers: {
      gemini: {
        textModels: [...DEFAULT_GEMINI_TEXT_MODELS],
        imageModels: [...DEFAULT_GEMINI_IMAGE_MODELS],
        defaultTextModel: DEFAULT_GEMINI_TEXT_MODELS[0] || "",
        defaultImageModel: DEFAULT_GEMINI_IMAGE_MODELS[0] || "",
        thinking: {
          supportsLevel: true,
          levelOptions: ["minimal", "low", "medium", "high"],
          supportsBudget: false,
          supportsBoolean: false,
          supportsString: false,
          stringSuggestions: [],
        },
      },
      ollama: {
        textModels: [...DEFAULT_OLLAMA_TEXT_MODELS],
        imageModels: [],
        defaultTextModel: DEFAULT_OLLAMA_TEXT_MODELS[0] || "",
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
  };
}

function normalizeThinkingLevelLabel(level: string) {
  if (level === "minimal") return "极简";
  if (level === "low") return "低";
  if (level === "medium") return "中";
  if (level === "high") return "高";
  return level || "中";
}

// --- High-End Audio & UI Components ---

/**
 * Google-Standard Quantum Symmetrical Waveform
 * Professional audio visualizer with binary sampling and Canvas rendering.
 */
function GoogleQuantumWaveform({ url, isPlaying, progress, onSeek, className = "" }: { url: string; isPlaying: boolean; progress: number; onSeek: (p: number) => void; className?: string }) {
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
          for (let i = 0; i < samples; i++) {
            const start = size * i;
            let sum = 0;
            for (let j = 0; j < size && start + j < raw.length; j++) sum += Math.abs(raw[start + j]);
            result.push(sum / size);
          }
          const max = Math.max(...result, 0);
          setPeaks(result.map(n => (max > 0 ? n / max : 0.05)));
        } finally {
          void ctx.close().catch(() => undefined);
        }
      } catch {
        if (active) setPeaks([]);
      }
      finally { if (active) setLoading(false); }
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
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    
    const render = () => {
      ctx.clearRect(0, 0, w, h);
      const count = peaks.length;
      const gap = 1.2;
      const barW = Math.max(1.2, (w - gap * (count - 1)) / count);
      const totalW = barW + gap;
      const offset = 0;
      peaks.forEach((p, i) => {
        const x = offset + i * totalW;
        const barH = Math.max(4, p * (h * 0.75));
        const y = (h - barH) / 2;
        const isPast = (i / Math.max(1, count - 1)) <= progress;
        ctx.fillStyle = isPast ? "#f43f5e" : "#27272a";
        ctx.beginPath(); ctx.roundRect(x, y, barW, barH, barW / 2); ctx.fill();
      });
    };
    render();
  }, [peaks, progress]);

  return (
    <div onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))); }} className={`relative flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm cursor-pointer ${className}`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-rose-500" /> : <canvas ref={canvasRef} className="h-full w-full" />}
    </div>
  );
}

function JsonStyleEditor({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [isFocused, setIsFocused] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => { if (preRef.current) { preRef.current.scrollTop = e.currentTarget.scrollTop; preRef.current.scrollLeft = e.currentTarget.scrollLeft; } };
  const formatted = useMemo(() => { try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; } }, [value]);
  const html = useMemo(() => highlightJson(formatted), [formatted]);

  return (
    <div className={`relative min-h-[300px] w-full rounded-2xl border transition-all duration-300 ${isFocused ? "border-rose-400 ring-4 ring-rose-500/10" : "border-zinc-200 bg-zinc-50/30 dark:border-zinc-800"}`}>
      <pre ref={preRef} className="absolute inset-0 overflow-hidden rounded-2xl p-4 font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-100 whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: html }} />
      <textarea value={value} onChange={(e) => onChange(e.target.value)} onScroll={handleScroll} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)} className="absolute inset-0 h-full w-full resize-none overflow-auto rounded-2xl bg-transparent p-4 font-mono text-xs leading-relaxed text-transparent caret-rose-500 outline-none selection:bg-rose-500/20" placeholder={placeholder} spellCheck={false} />
    </div>
  );
}

function PromptListCard({
  item,
  canDelete,
  onView,
  onCopy,
  onDelete,
}: {
  item: PromptResource;
  canDelete: boolean;
  onView: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-zinc-200 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_18px_40px_-20px_rgba(244,63,94,0.35)] dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500/70 via-pink-400/60 to-transparent opacity-80" />

      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-500 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300">
          <Sparkles size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black tracking-tight text-zinc-900 dark:text-zinc-100">
            {item.title || "未命名提示词"}
          </p>
          <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">提示词</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="line-clamp-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          {item.content || "暂无提示词内容"}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <div className="flex min-w-0 items-center gap-2 text-[11px] text-zinc-500">
          <img src={item.publisherAvatar} className="h-6 w-6 rounded-full border border-zinc-200 dark:border-zinc-700" alt="" />
          <span className="truncate font-semibold">{item.publisherName}</span>
          <span className="text-zinc-300">|</span>
          <span className="font-semibold">{formatPublishDate(item.publishedAt)}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button onClick={onView} className="inline-flex h-8 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" title="查看">
            <Eye size={13} className="mr-1" />
            查看
          </button>
          <button onClick={onCopy} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" title="复制">
            <Copy size={13} />
          </button>
          {canDelete ? (
            <button onClick={onDelete} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400" title="删除">
              <Trash2 size={13} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function getLibraryItemSummary(type: AssetType, item: any) {
  if (type === "prompts") return asString(item.content) || "暂无提示词内容";
  if (type === "styles") {
    const filtered = filterInternalKeys((item.spec ?? {}) as Record<string, unknown>) ?? {};
    const text = JSON.stringify(filtered);
    return text.length > 120 ? `${text.slice(0, 120)}...` : text || "暂无风格定义";
  }
  const visual = (item.visualSpec ?? {}) as Record<string, unknown>;
  const desc =
    asString(visual["画面描述"]) ||
    asString(visual.description) ||
    asString(visual["主体对象"]) ||
    "";
  if (desc) return desc;
  const raw = JSON.stringify(filterInternalKeys(visual) ?? {});
  return raw.length > 120 ? `${raw.slice(0, 120)}...` : raw || "暂无内容";
}

function LegacyAssetCard({
  type,
  item,
  canDelete,
  onView,
  onCopy,
  onDelete,
}: {
  type: AssetType;
  item: any;
  canDelete: boolean;
  onView: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const meta = ASSET_META[type];
  const Icon = meta.icon;
  const summary = getLibraryItemSummary(type, item);
  const gender = type === "characters" ? asString(item.visualSpec?.[GENDER_SPEC_KEY]) || "未知" : "";
  return (
    <article className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <p className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.name || item.title || "未命名"}</p>
          {gender && type === "characters" ? (
            <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{gender}</span>
          ) : null}
        </div>
        <p className="line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{summary}</p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
          <img src={item.publisherAvatar} className="h-5 w-5 rounded-full border border-zinc-200 dark:border-zinc-700" alt="" />
          <span className="truncate">{item.publisherName}</span>
          <span>·</span>
          <span>{formatPublishDate(item.publishedAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button onClick={onView} className="inline-flex h-8 items-center justify-center rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" title="查看">
          <Eye size={13} className="mr-1" />
          查看
        </button>
        <button onClick={onCopy} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200" title="复制">
          <Copy size={13} />
        </button>
        {canDelete ? (
          <button onClick={onDelete} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400" title="删除">
            <Trash2 size={13} />
          </button>
        ) : null}
      </div>
    </article>
  );
}

function AssetGalleryCard({ type, item, canDelete, onView, onCopy, onDelete }: { type: AssetType; item: any; canDelete: boolean; onView: () => void; onCopy: () => void; onDelete: () => void }) {
  const meta = ASSET_META[type];
  const previewUrl = type === "styles" ? getStylePreviewUrl(item) : getReferenceMedia(item);
  const spec = type === "styles" ? (item.spec || {}) : (item.visualSpec || {});
  const filteredSpec = filterInternalKeys(spec) || {};
  const tags = Object.values(filteredSpec).filter(v => typeof v === "string" && v.length > 0 && v.length < 24).slice(0, 8) as string[];
  const gender = type === "characters" ? asString(item.visualSpec?.[GENDER_SPEC_KEY]) : null;

  return (
    <article className="group relative flex flex-col rounded-[32px] border border-zinc-100 bg-white p-3 transition-all duration-500 hover:border-rose-200/60 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] dark:bg-zinc-900/60">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[24px] bg-zinc-50 dark:bg-zinc-950">
        {previewUrl ? <img src={previewUrl} className="h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="" /> : <div className="flex h-full w-full items-center justify-center text-zinc-300"><meta.icon size={40} strokeWidth={1} /></div>}
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <span className="rounded-full bg-black/60 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white backdrop-blur-md">{meta.label}</span>
          {gender && gender !== "未知" && <span className={`rounded-full px-2.5 py-1 text-[9px] font-black tracking-widest text-white shadow-md ${gender === "男" ? "bg-blue-500/80" : "bg-rose-500/80"}`}>{gender}</span>}
        </div>
        <div className="absolute inset-0 flex items-center justify-center gap-3 bg-zinc-950/10 opacity-0 backdrop-blur-[2px] transition-all duration-300 group-hover:opacity-100">
          <button onClick={onView} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-900 shadow-2xl transition-all hover:scale-110 active:scale-90"><Eye size={20} strokeWidth={2.5} /></button>
          <button onClick={onCopy} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-900 shadow-2xl transition-all hover:scale-110 active:scale-95"><Copy size={20} strokeWidth={2.5} /></button>
          {canDelete && <button onClick={onDelete} className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-500 text-white shadow-2xl transition-all hover:scale-110 active:scale-95"><Trash2 size={20} strokeWidth={2.5} /></button>}
        </div>
      </div>
      <div className="flex flex-1 flex-col px-1 pt-4">
        <h3 className="mb-1.5 truncate text-[15px] font-black tracking-tight text-zinc-900 dark:text-zinc-100">{item.name || item.title || "未命名"}</h3>
        <div className="flex flex-wrap gap-1.5 mb-5 content-start min-h-[40px]">{tags.map((val, idx) => <span key={idx} className="rounded-lg bg-zinc-50 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{val}</span>)}</div>
        <div className="mt-auto flex items-center justify-between border-t border-zinc-50 pt-4 dark:border-zinc-800/50">
          <div className="flex items-center gap-2">
            <img src={item.publisherAvatar} className="h-6 w-6 rounded-full border border-zinc-100" alt="" />
            <div className="flex flex-col"><span className="text-[11px] font-black text-zinc-800 dark:text-zinc-200">{item.publisherName}</span><span className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter">发布者</span></div>
          </div>
          <span className="text-[10px] font-bold text-zinc-400">{formatPublishDate(item.publishedAt)}</span>
        </div>
      </div>
    </article>
  );
}

function GoogleQuantumVoiceCard({ item, canDelete, onDelete, onView }: { item: VoiceResource; canDelete: boolean; onDelete: () => void; onView: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const url = getVoiceSampleAudioUrl(item);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) { toast.info("暂无试听样本"); return; }
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.onended = () => { setIsPlaying(false); setProgress(0); };
      audioRef.current.ontimeupdate = () => { if (audioRef.current && audioRef.current.duration > 0) setProgress(audioRef.current.currentTime / audioRef.current.duration); };
      audioRef.current.onplay = () => setIsPlaying(true);
      audioRef.current.onpause = () => setIsPlaying(false);
      const syncDuration = () => {
        if (audioRef.current && Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
          setDuration(audioRef.current.duration);
        }
      };
      audioRef.current.onloadedmetadata = syncDuration;
      audioRef.current.ondurationchange = syncDuration;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused && !audio.ended) {
      audio.pause();
      return;
    }
    void audio.play().catch(() => {
      toast.error("音频播放失败，请稍后重试");
    });
  };

  const handleSeek = (p: number) => {
    if (audioRef.current && audioRef.current.duration > 0) {
      audioRef.current.currentTime = p * audioRef.current.duration;
      setProgress(p);
      if (!isPlaying) { void audioRef.current.play(); setIsPlaying(true); }
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) {
      toast.info("暂无可下载音频");
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${item.name || "voice-sample"}.mp3`;
    anchor.rel = "noopener";
    anchor.target = "_blank";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  useEffect(() => {
    if (!url) {
      setDuration(null);
      return;
    }
    const probe = new Audio(url);
    probe.preload = "metadata";
    const syncDuration = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        setDuration(probe.duration);
      }
    };
    probe.addEventListener("loadedmetadata", syncDuration);
    probe.addEventListener("durationchange", syncDuration);
    return () => {
      probe.removeEventListener("loadedmetadata", syncDuration);
      probe.removeEventListener("durationchange", syncDuration);
      probe.src = "";
    };
  }, [url]);

  useEffect(() => () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } }, []);

  return (
    <article className="group relative flex flex-col rounded-[28px] border border-zinc-200 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_20px_44px_-24px_rgba(244,63,94,0.4)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-500/70 via-rose-300/70 to-transparent opacity-80" />

      <div className="relative overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-950 shadow-inner">
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[9px] font-black tracking-widest text-white backdrop-blur">配音音色</span>
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black text-zinc-700">
            {normalizeVoiceGenderLabel(asString(item.config?.gender))}
          </span>
        </div>
        <div className="absolute right-3 top-3 z-10 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
          {formatAudioDuration(duration)}
        </div>
        <button
          onClick={togglePlay}
          className="absolute left-3 bottom-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-zinc-950/75 text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-zinc-900/85 active:scale-95"
          title={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-1 rounded-full bg-white" />
              <span className="h-3.5 w-1 rounded-full bg-white" />
            </span>
          ) : (
            <span
              className="ml-0.5 block h-0 w-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-white"
              aria-hidden="true"
            />
          )}
        </button>
        <div className="aspect-[16/9] w-full">
          <GoogleQuantumWaveform url={url} isPlaying={isPlaying} progress={progress} onSeek={handleSeek} className="h-full w-full" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[18px] font-black tracking-tight text-zinc-900">{item.name || "未命名音色"}</h3>
            <p className="mt-0.5 truncate text-[11px] font-semibold text-zinc-500">{item.previewText || "用于剧本配音预览的音色样本"}</p>
          </div>
          <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-bold text-zinc-600">
            {item.provider || "custom"}
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <img src={item.publisherAvatar} className="h-7 w-7 rounded-full border border-zinc-200" alt="" />
            <div className="min-w-0">
              <p className="truncate text-[12px] font-black text-zinc-800">{item.publisherName}</p>
              <p className="text-[10px] font-semibold text-zinc-400">{formatPublishDate(item.publishedAt)}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <button
              onClick={onView}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all hover:scale-105 hover:bg-zinc-50 active:scale-95"
              title="查看"
            >
              <Eye size={16} />
            </button>
            <button
              onClick={handleDownload}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm transition-all hover:scale-105 hover:bg-zinc-50 active:scale-95"
              title="下载音频"
            >
              <Download size={16} />
            </button>
            {canDelete ? (
              <button
                onClick={onDelete}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-500 shadow-sm transition-all hover:scale-105 hover:bg-red-100 active:scale-95"
                title="删除"
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

// --- Main Hub Panel ---

export function LibraryHubPanel() {
  const [loading, setLoading] = useState(true);
  const [syncIssue, setSyncIssue] = useState("");
  const [activeTab, setActiveTab] = useState<AssetType>("prompts");
  const [searchQuery, setSearchQuery] = useState("");
  const [bundles, setBundles] = useState<ProjectLibraryBundle[]>([]);
  const [globalLibraryProjectID, setGlobalLibraryProjectID] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<AssetType>("prompts");
  const [creating, setCreating] = useState(false);

  const [promptDraft, setPromptDraft] = useState<PromptDraft>({ title: "", content: "" });
  const [styleDraft, setStyleDraft] = useState<StyleDraft>({ name: "", content: "{}" });
  const [characterDraft, setCharacterDraft] = useState<CharacterDraft>({ name: "", gender: "未知" });
  const [environmentDraft, setEnvironmentDraft] = useState<EnvironmentDraft>({ name: "" });
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft>({ name: "", gender: "未知" });

  const [confirmState, setConfirmState] = useState<{ title: string; action: () => Promise<void> } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  
  const [viewingPrompt, setViewingPrompt] = useState<PromptResource | null>(null);
  const [viewingStyle, setViewingStyle] = useState<StyleResource | null>(null);
  const [viewingCharacter, setViewingCharacter] = useState<CharacterResource | null>(null);
  const [viewingEnvironment, setViewingEnvironment] = useState<EnvironmentResource | null>(null);
  const [viewingVoice, setViewingVoice] = useState<VoiceResource | null>(null);

  const [styleEditorName, setStyleEditorName] = useState("");
  const [styleSpecInputText, setStyleSpecInputText] = useState("{}");
  const [styleSaving, setStyleSaving] = useState(false);
  const [stylePreviewImage, setStylePreviewImage] = useState("");
  const styleFileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceSampleFileInputRef = useRef<HTMLInputElement | null>(null);
  const voiceSampleAudioRef = useRef<HTMLAudioElement | null>(null);
  const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [voiceEditorName, setVoiceEditorName] = useState("");
  const [voiceEditorGender, setVoiceEditorGender] = useState("未知");
  const [voiceEditorVoiceID, setVoiceEditorVoiceID] = useState("");
  const [voiceEditorProvider, setVoiceEditorProvider] = useState("");
  const [voiceSampleAudioUrl, setVoiceSampleAudioUrl] = useState("");
  const [voiceSampleUploadLoading, setVoiceSampleUploadLoading] = useState(false);
  const [voiceProfileSaving, setVoiceProfileSaving] = useState(false);

  const [voiceSampleIsPlaying, setVoiceSampleIsPlaying] = useState(false);
  const [voiceSampleProgress, setVoiceSampleProgress] = useState(0);
  const [voiceSampleDuration, setVoiceSampleDuration] = useState<number | null>(null);
  const [voicePreviewIsPlaying, setVoicePreviewIsPlaying] = useState(false);
  const [voicePreviewProgress, setVoicePreviewProgress] = useState(0);
  const [voicePreviewDuration, setVoicePreviewDuration] = useState<number | null>(null);
  const [voicePreviewLoading, setVoicePreviewLoading] = useState(false);
  const [voicePreviewServerUrl, setVoicePreviewServerUrl] = useState("");
  const [voicePreviewModel, setVoicePreviewModel] = useState("");
  const [showVoicePreviewConfig, setShowVoicePreviewConfig] = useState(false);
  const [voicePreviewText, setVoicePreviewText] = useState("");
  const [voicePreviewAudioUrl, setVoicePreviewAudioUrl] = useState("");
  const [promptEditorTitle, setPromptEditorTitle] = useState("");
  const [promptEditorContent, setPromptEditorContent] = useState("");
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptPreviewLoading, setPromptPreviewLoading] = useState(false);
  const [promptPreviewResult, setPromptPreviewResult] = useState("");
  const [promptPreviewProvider, setPromptPreviewProvider] = useState<GenerationProvider>("ollama");
  const [promptPreviewModel, setPromptPreviewModel] = useState("");
  const [promptGeminiThinkingLevel, setPromptGeminiThinkingLevel] = useState<GeminiThinkingLevel>("medium");
  const [promptOllamaThinkMode, setPromptOllamaThinkMode] = useState<OllamaThinkMode>("none");
  const [promptOllamaThinkBoolean, setPromptOllamaThinkBoolean] = useState(true);
  const [promptOllamaThinkString, setPromptOllamaThinkString] = useState("medium");
  const [showPromptPreviewPanel, setShowPromptPreviewPanel] = useState(false);
  const [showPromptPreviewConfig, setShowPromptPreviewConfig] = useState(false);

  const [stylePreviewMode, setStylePreviewMode] = useState<"upload" | "gemini">("upload");
  const [stylePreviewModel, setStylePreviewModel] = useState("");
  const [stylePreviewAspectRatio, setStylePreviewAspectRatio] = useState("16:9");
  const [stylePreviewResolution, setStylePreviewResolution] = useState("1024x1024");
  const [stylePreviewLoading, setStylePreviewLoading] = useState(false);
  const [styleUploadLoading, setStyleUploadLoading] = useState(false);
  const [showAssetPreviewTools, setShowAssetPreviewTools] = useState(false);
  const [showStyleGeminiConfig, setShowStyleGeminiConfig] = useState(false);
  const [showVoicePreviewTools, setShowVoicePreviewTools] = useState(false);

  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [modelsCatalog, setModelsCatalog] = useState<ModelsCatalogResponse>(buildDefaultModelsCatalog);
  const editorLabel = viewingStyle ? "艺术风格" : viewingCharacter ? "角色视图" : viewingEnvironment ? "场景素材" : "资料";

  const resetAudioRef = useCallback(
    (
      ref: React.MutableRefObject<HTMLAudioElement | null>,
      setPlaying: React.Dispatch<React.SetStateAction<boolean>>,
      setProgress: React.Dispatch<React.SetStateAction<number>>,
      setDuration?: React.Dispatch<React.SetStateAction<number | null>>,
    ) => {
      const audio = ref.current;
      if (audio) {
        audio.pause();
        audio.onended = null;
        audio.ontimeupdate = null;
        audio.onplay = null;
        audio.onpause = null;
        audio.onloadedmetadata = null;
        audio.ondurationchange = null;
        audio.src = "";
        ref.current = null;
      }
      setPlaying(false);
      setProgress(0);
      if (setDuration) setDuration(null);
    },
    [],
  );

  const ensureAudioRef = useCallback(
    (
      ref: React.MutableRefObject<HTMLAudioElement | null>,
      url: string,
      setPlaying: React.Dispatch<React.SetStateAction<boolean>>,
      setProgress: React.Dispatch<React.SetStateAction<number>>,
      setDuration: React.Dispatch<React.SetStateAction<number | null>>,
    ) => {
      if (!url) return null;
      if (!ref.current || ref.current.src !== url) {
        resetAudioRef(ref, setPlaying, setProgress, setDuration);
        const audio = new Audio(url);
        audio.preload = "metadata";
        audio.onended = () => {
          setPlaying(false);
          setProgress(0);
        };
        audio.ontimeupdate = () => {
          if (audio.duration > 0) {
            setProgress(audio.currentTime / audio.duration);
          }
        };
        audio.onplay = () => setPlaying(true);
        audio.onpause = () => setPlaying(false);
        const syncDuration = () => {
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setDuration(audio.duration);
          }
        };
        audio.onloadedmetadata = syncDuration;
        audio.ondurationchange = syncDuration;
        ref.current = audio;
      }
      return ref.current;
    },
    [resetAudioRef],
  );

  const closePromptViewer = useCallback(() => {
    setViewingPrompt(null);
    setPromptEditorTitle("");
    setPromptEditorContent("");
    setPromptPreviewResult("");
    setPromptSaving(false);
    setPromptPreviewLoading(false);
    setPromptGeminiThinkingLevel("medium");
    setPromptOllamaThinkMode("none");
    setPromptOllamaThinkBoolean(true);
    setPromptOllamaThinkString("medium");
    setShowPromptPreviewPanel(false);
    setShowPromptPreviewConfig(false);
  }, []);

  const closeAssetViewer = useCallback(() => {
    setViewingStyle(null);
    setViewingCharacter(null);
    setViewingEnvironment(null);
    setStyleEditorName("");
    setStyleSpecInputText("{}");
    setStylePreviewImage("");
    setStylePreviewMode("upload");
    setShowAssetPreviewTools(false);
    setShowStyleGeminiConfig(false);
    setStyleSaving(false);
    setStylePreviewAspectRatio("16:9");
    setStylePreviewResolution("1024x1024");
    setStylePreviewLoading(false);
    setStyleUploadLoading(false);
    setCharacterDraft((prev) => ({ ...prev, gender: "未知" }));
  }, []);

  const closeVoiceViewer = useCallback(() => {
    resetAudioRef(voiceSampleAudioRef, setVoiceSampleIsPlaying, setVoiceSampleProgress, setVoiceSampleDuration);
    resetAudioRef(voicePreviewAudioRef, setVoicePreviewIsPlaying, setVoicePreviewProgress, setVoicePreviewDuration);
    setViewingVoice(null);
    setVoiceEditorName("");
    setVoiceEditorGender("未知");
    setVoiceEditorVoiceID("");
    setVoiceEditorProvider("");
    setVoiceSampleAudioUrl("");
    setVoiceSampleUploadLoading(false);
    setVoiceProfileSaving(false);
    setVoicePreviewLoading(false);
    setVoicePreviewServerUrl("");
    setVoicePreviewModel("");
    setShowVoicePreviewConfig(false);
    setVoicePreviewText("");
    setVoicePreviewAudioUrl("");
    setShowVoicePreviewTools(false);
    if (voiceSampleFileInputRef.current) voiceSampleFileInputRef.current.value = "";
  }, [resetAudioRef]);

  useEffect(
    () => () => {
      resetAudioRef(voiceSampleAudioRef, setVoiceSampleIsPlaying, setVoiceSampleProgress, setVoiceSampleDuration);
      resetAudioRef(voicePreviewAudioRef, setVoicePreviewIsPlaying, setVoicePreviewProgress, setVoicePreviewDuration);
    },
    [resetAudioRef],
  );

  const syncLibrary = useCallback(async () => {
    try {
      const payload = await fetchJSON<{ items?: WorkspaceProject[] }>("/api/studio/projects");
      let global = (payload.items ?? []).find(p => p.tags?.includes(SYSTEM_LIBRARY_TAG));
      if (!global) {
        global = await fetchJSON<WorkspaceProject>("/api/studio/projects", { method: "POST", body: JSON.stringify({ name: SYSTEM_LIBRARY_NAME, tags: [SYSTEM_LIBRARY_TAG], visibility: "private" }) });
      }
      const library = await fetchJSON<WorkspaceProjectLibrary>(`/api/studio/projects/${global.id}/library`);
      setGlobalLibraryProjectID(global.id);
      setBundles([{ project: global, library }]);
      setSyncIssue("");
    } catch { setSyncIssue("同步失败，请尝试刷新页面"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void syncLibrary(); }, [syncLibrary]);

  useEffect(() => {
    let cancelled = false;
    setLoadingModels(true);
    setModelsError("");
    void fetch("/api/studio/script/models", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ModelsCatalogResponse | { error?: string } | null;
        if (!response.ok) {
          throw new Error((payload as { error?: string } | null)?.error || `Request failed (${response.status})`);
        }
        if (!cancelled && payload && "providers" in payload) {
          const catalog = payload as ModelsCatalogResponse;
          setModelsCatalog(catalog);
          const nextPromptProvider: GenerationProvider = (catalog.providers.ollama?.textModels?.length ?? 0) > 0 ? "ollama" : "gemini";
          setPromptPreviewProvider(nextPromptProvider);
          if (nextPromptProvider === "ollama") {
            setPromptPreviewModel(catalog.providers.ollama.defaultTextModel || catalog.providers.ollama.textModels[0] || "");
          } else {
            setPromptPreviewModel(catalog.providers.gemini.defaultTextModel || catalog.providers.gemini.textModels[0] || "");
          }
          setStylePreviewModel(catalog.providers.gemini.defaultImageModel || catalog.providers.gemini.imageModels[0] || "");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setModelsError(error instanceof Error ? error.message : "模型列表加载失败");
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const providerCatalog =
      promptPreviewProvider === "gemini" ? modelsCatalog.providers.gemini : modelsCatalog.providers.ollama;
    const models = providerCatalog?.textModels ?? [];
    if (!models.length) {
      if (promptPreviewModel !== "") setPromptPreviewModel("");
      return;
    }
    if (!promptPreviewModel || !models.includes(promptPreviewModel)) {
      setPromptPreviewModel(providerCatalog.defaultTextModel || models[0] || "");
    }
  }, [modelsCatalog, promptPreviewProvider, promptPreviewModel]);

  useEffect(() => {
    const imageModels = modelsCatalog.providers.gemini?.imageModels ?? [];
    if (!imageModels.length) {
      if (stylePreviewModel !== "") setStylePreviewModel("");
      return;
    }
    if (!stylePreviewModel || !imageModels.includes(stylePreviewModel)) {
      setStylePreviewModel(modelsCatalog.providers.gemini.defaultImageModel || imageModels[0] || "");
    }
  }, [modelsCatalog, stylePreviewModel]);

  const aggregate = useMemo<LibraryAggregate>(() => {
    const acc: LibraryAggregate = { prompts: [], styles: [], characters: [], environments: [], voices: [] };
    bundles.forEach(b => {
      const pubName = b.project.owner?.nickname || "系统";
      const pubAvatar = buildNotionistsAvatar(b.project.owner?.avatarSeed || "lib", "f4f4f5");
      const wrap = (items: any[]) => (items ?? []).map(i => ({ ...i, projectId: b.project.id, publisherName: pubName, publisherAvatar: pubAvatar, publishedAt: i.createdAt }));
      acc.prompts.push(...wrap(b.library.prompts));
      acc.styles.push(...wrap(b.library.styles));
      acc.characters.push(...wrap(b.library.characters));
      acc.environments.push(...wrap(b.library.environments));
      acc.voices.push(...wrap(b.library.voices));
    });
    return acc;
  }, [bundles]);

  const filteredAssets = useMemo(() => {
    const pool = aggregate[activeTab] ?? [];
    if (!searchQuery.trim()) return pool;
    const q = searchQuery.toLowerCase();
    return pool.filter((i: any) => (i.name || i.title || "").toLowerCase().includes(q));
  }, [aggregate, activeTab, searchQuery]);

  const handleCreate = async () => {
    if (!globalLibraryProjectID) return;
    setCreating(true);
    try {
      let body: any = {};
      if (createType === "prompts") body = { title: promptDraft.title, content: promptDraft.content };
      else if (createType === "styles") body = { name: styleDraft.name, spec: JSON.parse(styleDraft.content || "{}") };
      else if (createType === "characters") body = { name: characterDraft.name, visualSpec: { 性别: characterDraft.gender } };
      else if (createType === "environments") body = { name: environmentDraft.name, visualSpec: {} };
      else body = { name: voiceDraft.name, provider: "custom", voiceId: `voice-${Date.now()}`, config: { sampleAudioUrl: "", gender: voiceDraft.gender } };

      await fetchJSON(`/api/studio/projects/${globalLibraryProjectID}/${createType}`, { method: "POST", body: JSON.stringify(body) });
      toast.success("资料已新增");
      setShowCreateModal(false);
      setPromptDraft({ title: "", content: "" });
      setStyleDraft({ name: "", content: "{}" });
      setCharacterDraft({ name: "", gender: "未知" });
      setEnvironmentDraft({ name: "" });
      setVoiceDraft({ name: "", gender: "未知" });
      await syncLibrary();
    } catch { toast.error("创建失败，内容格式可能错误"); }
    finally { setCreating(false); }
  };

  const handleUpdate = async () => {
    const active = viewingStyle || viewingCharacter || viewingEnvironment;
    if (!active) return;
    setStyleSaving(true);
    try {
      const parsed = JSON.parse(styleSpecInputText);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("JSON 必须为对象");
      }
      const spec = parsed as Record<string, unknown>;
      const type = viewingStyle ? "styles" : viewingCharacter ? "characters" : "environments";
      const body: any = { name: styleEditorName.trim() };
      if (viewingStyle) {
        const currentPreview = getStylePreviewUrl(viewingStyle);
        body.spec = {
          ...normalizeEditableSpec(viewingStyle.spec),
          ...spec,
        };
        if (stylePreviewImage || currentPreview) {
          body.spec.previewImageUrl = stylePreviewImage || currentPreview;
        }
      } else if (viewingCharacter) {
        body.visualSpec = {
          ...normalizeEditableSpec(viewingCharacter.visualSpec),
          ...spec,
          性别: characterDraft.gender,
        };
      } else if (viewingEnvironment) {
        body.visualSpec = {
          ...normalizeEditableSpec(viewingEnvironment.visualSpec),
          ...spec,
        };
      }
      if (stylePreviewImage && (viewingCharacter || viewingEnvironment)) {
        body.visualSpec["参考图"] = stylePreviewImage;
      }
      await fetchJSON(`/api/studio/${type}/${active.id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast.success("资料已更新"); await syncLibrary();
    } catch { toast.error("更新失败，请检查定义格式"); }
    finally { setStyleSaving(false); }
  };

  const handleUpdatePrompt = async () => {
    if (!viewingPrompt) return;
    setPromptSaving(true);
    try {
      await fetchJSON(`/api/studio/prompts/${viewingPrompt.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: promptEditorTitle.trim(),
          content: promptEditorContent,
        }),
      });
      toast.success("提示词已更新");
      closePromptViewer();
      await syncLibrary();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提示词更新失败");
    } finally {
      setPromptSaving(false);
    }
  };

  const handlePreviewPrompt = async () => {
    if (!viewingPrompt) return;
    const source = promptEditorContent.trim();
    if (!source) {
      toast.error("请先输入提示词内容");
      return;
    }
    if (!promptPreviewModel.trim()) {
      toast.error("请先选择预览模型");
      return;
    }
    setPromptPreviewLoading(true);
    try {
      const payload = await fetchJSON<{ content?: string }>(
        "/api/studio/prompts/preview",
        {
          method: "POST",
          body: JSON.stringify({
            prompt: source,
            promptId: viewingPrompt.id,
            provider: promptPreviewProvider,
            model: promptPreviewModel.trim(),
            geminiThinkingLevel: promptGeminiThinkingLevel,
            ollamaThinkMode: promptOllamaThinkMode,
            ollamaThinkBoolean: promptOllamaThinkBoolean,
            ollamaThinkString: promptOllamaThinkString.trim(),
          }),
        },
      );
      setPromptPreviewResult(asString(payload.content));
      toast.success("已生成结果预览");
      await syncLibrary();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "预览生成失败");
    } finally {
      setPromptPreviewLoading(false);
    }
  };

  const handleGenerateStylePreview = async () => {
    if (!viewingStyle && !viewingCharacter && !viewingEnvironment) return;
    const rawSpec = styleSpecInputText.trim();
    if (!rawSpec) {
      toast.error("请先填写 JSON 定义");
      return;
    }
    let parsedSpec: Record<string, unknown>;
    try {
      const parsed = JSON.parse(rawSpec);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        toast.error("JSON 定义必须为对象");
        return;
      }
      if (Object.keys(parsed as Record<string, unknown>).length === 0) {
        toast.error("JSON 定义为空，请先填写内容");
        return;
      }
      parsedSpec = parsed as Record<string, unknown>;
    } catch {
      toast.error("JSON 定义格式错误，请先修正");
      return;
    }
    setStylePreviewLoading(true);
    try {
      const payload = await fetchJSON<{ imageUrl?: string; imageDataUrl?: string; imageBase64?: string; modelUsed?: string }>(
        "/api/studio/styles/preview/gemini",
        {
          method: "POST",
          body: JSON.stringify({
            prompt: JSON.stringify(parsedSpec, null, 2),
            model: stylePreviewModel.trim(),
            aspectRatio: stylePreviewAspectRatio,
            resolution: stylePreviewResolution,
            referenceImages: stylePreviewImage ? [stylePreviewImage] : [],
          }),
        },
      );
      const nextImage =
        asString(payload.imageUrl) ||
        asString(payload.imageDataUrl) ||
        (asString(payload.imageBase64) ? `data:image/png;base64,${asString(payload.imageBase64)}` : "");
      if (!nextImage) {
        throw new Error("Gemini 未返回图片");
      }
      setStylePreviewImage(nextImage);
      toast.success(`风格预览已生成（${asString(payload.modelUsed) || "默认模型"}）`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "风格预览生成失败");
    } finally {
      setStylePreviewLoading(false);
    }
  };

  const handleUploadStylePreview = async (file: File) => {
    if (!viewingStyle && !viewingCharacter && !viewingEnvironment) return;
    setStyleUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (viewingStyle?.id) {
        formData.append("styleId", viewingStyle.id);
      }
      const response = await fetch("/api/studio/styles/preview/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || `Request failed (${response.status})`);
      }
      const uploadedUrl = asString(payload?.url);
      if (!uploadedUrl) {
        throw new Error("上传成功但未返回图片地址");
      }
      setStylePreviewImage(uploadedUrl);
      toast.success("图片已上传，可保存到资料库");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setStyleUploadLoading(false);
      if (styleFileInputRef.current) styleFileInputRef.current.value = "";
    }
  };

  const handleUploadVoiceSample = async (file: File) => {
    if (!viewingVoice) return;
    setVoiceSampleUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("voiceId", voiceEditorVoiceID || viewingVoice.voiceId);
      const response = await fetch("/api/studio/voices/sample/upload", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; url?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || `Request failed (${response.status})`);
      }
      const uploadedUrl = asString(payload?.url);
      if (!uploadedUrl) {
        throw new Error("上传成功但未返回音频地址");
      }
      resetAudioRef(voiceSampleAudioRef, setVoiceSampleIsPlaying, setVoiceSampleProgress, setVoiceSampleDuration);
      setVoiceSampleAudioUrl(uploadedUrl);
      toast.success("音色样本已上传");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "音色样本上传失败");
    } finally {
      setVoiceSampleUploadLoading(false);
      if (voiceSampleFileInputRef.current) voiceSampleFileInputRef.current.value = "";
    }
  };

  const handleSaveVoiceProfile = async () => {
    if (!viewingVoice) return;
    const nextName = voiceEditorName.trim();
    const nextVoiceID = voiceEditorVoiceID.trim();
    if (!nextName) {
      toast.error("请先填写音色名称");
      return;
    }
    if (!nextVoiceID) {
      toast.error("请先填写音色 ID");
      return;
    }
    setVoiceProfileSaving(true);
    try {
      const nextConfig: Record<string, unknown> = {
        ...((viewingVoice.config ?? {}) as Record<string, unknown>),
        gender: voiceEditorGender,
      };
      if (voiceSampleAudioUrl) {
        nextConfig.sampleAudioUrl = voiceSampleAudioUrl;
      }
      if (voicePreviewServerUrl.trim()) {
        nextConfig.previewServerUrl = voicePreviewServerUrl.trim();
      }
      if (voicePreviewModel.trim()) {
        nextConfig.previewModel = voicePreviewModel.trim();
      }
      await fetchJSON<WorkspaceVoicePreset>(`/api/studio/voices/${viewingVoice.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: nextName,
          provider: voiceEditorProvider || viewingVoice.provider,
          voiceId: nextVoiceID,
          config: nextConfig,
          previewText: voicePreviewText.trim() || viewingVoice.previewText || "",
        }),
      });
      setViewingVoice((prev) =>
        prev
          ? {
              ...prev,
              name: nextName,
              voiceId: nextVoiceID,
              provider: voiceEditorProvider || prev.provider,
              config: nextConfig,
              previewText: voicePreviewText.trim() || prev.previewText,
            }
          : prev,
      );
      toast.success("音色资料已保存");
      await syncLibrary();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "音色资料保存失败");
    } finally {
      setVoiceProfileSaving(false);
    }
  };

  const handleGenerateVoicePreview = async () => {
    if (!viewingVoice) return;
    const text = voicePreviewText.trim();
    if (!text) {
      toast.error("请先输入预览文本");
      return;
    }
    if (text.length > 20) {
      toast.error("预览文本最多 20 个字");
      return;
    }
    setVoicePreviewLoading(true);
    try {
      const res = await fetchJSON<{ audioUrl?: string; audioDataUrl?: string; modelUsed?: string }>(
        "/api/studio/voices/preview/indextts",
        {
          method: "POST",
          body: JSON.stringify({
            voicePresetId: viewingVoice.id,
            voiceId: voiceEditorVoiceID || viewingVoice.voiceId,
            name: voiceEditorName || viewingVoice.name,
            gender: voiceEditorGender,
            text,
            sampleAudioUrl: voiceSampleAudioUrl || getVoiceSampleAudioUrl(viewingVoice),
            serverUrl: voicePreviewServerUrl.trim(),
            model: voicePreviewModel.trim(),
          }),
        },
      );
      const nextUrl = asString(res.audioUrl) || asString(res.audioDataUrl);
      if (!nextUrl) throw new Error("预览服务未返回音频");
      resetAudioRef(voicePreviewAudioRef, setVoicePreviewIsPlaying, setVoicePreviewProgress, setVoicePreviewDuration);
      setVoicePreviewAudioUrl(nextUrl);
      if (asString(res.modelUsed)) setVoicePreviewModel(asString(res.modelUsed));
      toast.success("已生成预览音频");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成预览失败");
    } finally {
      setVoicePreviewLoading(false);
    }
  };

  const toggleVoiceSamplePlay = () => {
    const sampleUrl = voiceSampleAudioUrl || (viewingVoice ? getVoiceSampleAudioUrl(viewingVoice) : "");
    if (!sampleUrl) {
      toast.info("暂无样本音频");
      return;
    }
    const audio = ensureAudioRef(voiceSampleAudioRef, sampleUrl, setVoiceSampleIsPlaying, setVoiceSampleProgress, setVoiceSampleDuration);
    if (!audio) return;
    if (voicePreviewAudioRef.current && !voicePreviewAudioRef.current.paused) {
      voicePreviewAudioRef.current.pause();
    }
    if (!audio.paused && !audio.ended) {
      audio.pause();
      return;
    }
    void audio.play().catch(() => toast.error("音频播放失败，请稍后重试"));
  };

  const seekVoiceSample = (p: number) => {
    const sampleUrl = voiceSampleAudioUrl || (viewingVoice ? getVoiceSampleAudioUrl(viewingVoice) : "");
    if (!sampleUrl) return;
    const audio = ensureAudioRef(voiceSampleAudioRef, sampleUrl, setVoiceSampleIsPlaying, setVoiceSampleProgress, setVoiceSampleDuration);
    if (!audio || audio.duration <= 0) return;
    audio.currentTime = Math.max(0, Math.min(1, p)) * audio.duration;
    setVoiceSampleProgress(Math.max(0, Math.min(1, p)));
  };

  const toggleVoicePreviewPlay = () => {
    if (!voicePreviewAudioUrl) {
      toast.info("暂无预览音频");
      return;
    }
    const audio = ensureAudioRef(voicePreviewAudioRef, voicePreviewAudioUrl, setVoicePreviewIsPlaying, setVoicePreviewProgress, setVoicePreviewDuration);
    if (!audio) return;
    if (voiceSampleAudioRef.current && !voiceSampleAudioRef.current.paused) {
      voiceSampleAudioRef.current.pause();
    }
    if (!audio.paused && !audio.ended) {
      audio.pause();
      return;
    }
    void audio.play().catch(() => toast.error("音频播放失败，请稍后重试"));
  };

  const seekVoicePreview = (p: number) => {
    if (!voicePreviewAudioUrl) return;
    const audio = ensureAudioRef(voicePreviewAudioRef, voicePreviewAudioUrl, setVoicePreviewIsPlaying, setVoicePreviewProgress, setVoicePreviewDuration);
    if (!audio || audio.duration <= 0) return;
    audio.currentTime = Math.max(0, Math.min(1, p)) * audio.duration;
    setVoicePreviewProgress(Math.max(0, Math.min(1, p)));
  };

  const openPromptViewer = (item: PromptResource) => {
    closeAssetViewer();
    closeVoiceViewer();
    setViewingPrompt(item);
    setShowPromptPreviewPanel(false);
    setShowPromptPreviewConfig(false);
    setPromptEditorTitle(item.title || "");
    setPromptEditorContent(item.content || "");
    setPromptPreviewResult(item.previewResult || "");
    const preferredProvider: GenerationProvider = (modelsCatalog.providers.ollama?.textModels?.length ?? 0) > 0 ? "ollama" : "gemini";
    setPromptPreviewProvider(preferredProvider);
    if (preferredProvider === "ollama") {
      setPromptPreviewModel(modelsCatalog.providers.ollama.defaultTextModel || modelsCatalog.providers.ollama.textModels[0] || "");
    } else {
      setPromptPreviewModel(modelsCatalog.providers.gemini.defaultTextModel || modelsCatalog.providers.gemini.textModels[0] || "");
    }
  };

  const openAssetViewer = (item: StyleResource | CharacterResource | EnvironmentResource, type: "styles" | "characters" | "environments") => {
    closePromptViewer();
    closeVoiceViewer();
    if (type === "styles") {
      const style = item as StyleResource;
      setViewingStyle(item as StyleResource);
      setViewingCharacter(null);
      setViewingEnvironment(null);
      setStyleEditorName(item.name || "");
      setStyleSpecInputText(buildStyleSpecEditorValue(style.spec));
      setStylePreviewImage(getStylePreviewUrl(style));
      setStylePreviewMode("upload");
      setShowAssetPreviewTools(false);
      setShowStyleGeminiConfig(false);
      setStylePreviewModel(modelsCatalog.providers.gemini.defaultImageModel || modelsCatalog.providers.gemini.imageModels[0] || "");
      return;
    }

    if (type === "characters") {
      const character = item as CharacterResource;
      setViewingStyle(null);
      setViewingCharacter(character);
      setViewingEnvironment(null);
      setStyleEditorName(character.name || "");
      setStyleSpecInputText(buildStyleSpecEditorValue(character.visualSpec));
      setStylePreviewImage(getReferenceMedia(character));
      setStylePreviewMode("upload");
      setShowAssetPreviewTools(false);
      setShowStyleGeminiConfig(false);
      setCharacterDraft((prev) => ({ ...prev, gender: asString(character.visualSpec?.[GENDER_SPEC_KEY]) || "未知" }));
      return;
    }

    const environment = item as EnvironmentResource;
    setViewingStyle(null);
    setViewingCharacter(null);
    setViewingEnvironment(environment);
    setStyleEditorName(environment.name || "");
    setStyleSpecInputText(buildStyleSpecEditorValue(environment.visualSpec));
    setStylePreviewImage(getReferenceMedia(environment));
    setStylePreviewMode("upload");
    setShowAssetPreviewTools(false);
    setShowStyleGeminiConfig(false);
  };

  const openVoiceViewer = (item: VoiceResource) => {
    closePromptViewer();
    closeAssetViewer();
    resetAudioRef(voiceSampleAudioRef, setVoiceSampleIsPlaying, setVoiceSampleProgress, setVoiceSampleDuration);
    resetAudioRef(voicePreviewAudioRef, setVoicePreviewIsPlaying, setVoicePreviewProgress, setVoicePreviewDuration);
    setViewingVoice(item);
    setVoiceEditorName(item.name || "");
    setVoiceEditorGender(normalizeVoiceGenderLabel(asString(item.config?.gender)));
    setVoiceEditorVoiceID(item.voiceId || "");
    setVoiceEditorProvider(item.provider || "custom");
    setVoiceSampleAudioUrl(getVoiceSampleAudioUrl(item));
    setShowVoicePreviewTools(false);
    setShowVoicePreviewConfig(false);
    setVoicePreviewServerUrl(asString(item.config?.previewServerUrl) || "");
    setVoicePreviewModel(asString(item.config?.previewModel) || "");
    setVoicePreviewText(item.previewText || "");
    setVoicePreviewAudioUrl("");
  };

  const createValid = useMemo(() => {
    const d = createType === "prompts" ? promptDraft.title && promptDraft.content : createType === "styles" ? styleDraft.name : createType === "characters" ? characterDraft.name : createType === "environments" ? environmentDraft.name : voiceDraft.name;
    return Boolean(d);
  }, [createType, promptDraft, styleDraft, characterDraft, environmentDraft, voiceDraft]);

  const styleSpecReadyForGemini = useMemo(() => {
    const raw = styleSpecInputText.trim();
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed as Record<string, unknown>).length > 0);
    } catch {
      return false;
    }
  }, [styleSpecInputText]);

  const promptProviderCatalog =
    promptPreviewProvider === "gemini" ? modelsCatalog.providers.gemini : modelsCatalog.providers.ollama;
  const promptProviderModels = promptProviderCatalog?.textModels ?? [];
  const promptProviderWarning = modelsCatalog.warningsByProvider?.[promptPreviewProvider] ?? "";
  const geminiImageModels = modelsCatalog.providers.gemini?.imageModels ?? [];
  const geminiProviderWarning = modelsCatalog.warningsByProvider?.gemini ?? "";

  if (loading) return <div className="flex h-screen items-center justify-center bg-white"><div className="flex flex-col items-center gap-4"><Loader2 className="h-10 w-10 animate-spin text-rose-500" /><p className="text-xs font-black uppercase tracking-widest text-zinc-400">正在同步云端资料库...</p></div></div>;

  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col px-3 md:px-8">
      <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-zinc-100 bg-white py-3 lg:h-16 lg:flex-row lg:items-center lg:justify-between">
        <nav className="flex gap-1 overflow-x-auto no-scrollbar">
          {(Object.keys(ASSET_META) as AssetType[]).map(k => (
            <button key={k} onClick={() => setActiveTab(k)} className={`px-4 py-2 text-sm font-bold transition-all ${activeTab === k ? "text-rose-600 border-b-2 border-rose-600" : "text-zinc-400 hover:text-zinc-900"}`}>{ASSET_META[k].label}</button>
          ))}
        </nav>
        <div className="flex gap-2">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="检索资料..." className="h-10 w-48 md:w-64 rounded-full bg-zinc-100 pl-9 pr-4 text-xs outline-none focus:ring-2 focus:ring-rose-500/20" /></div>
                  <button onClick={() => setShowCreateModal(true)} className="rounded-full bg-zinc-900 px-5 text-xs font-bold text-white hover:bg-rose-600 transition-all flex items-center gap-2"><Plus size={16} />新增资料</button>
        </div>
      </header>

      {syncIssue ? (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
          <span>{syncIssue}</span>
          <button
            onClick={() => {
              setLoading(true);
              void syncLibrary();
            }}
            className="rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
          >
            重新同步
          </button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto py-6">
        {filteredAssets.length === 0 ? <div className="py-20 text-center text-zinc-400 font-medium">暂无匹配资料</div> : (
          <div
            className={
              activeTab === "voices" || activeTab === "styles" || activeTab === "characters" || activeTab === "environments"
                ? "grid grid-cols-2 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 animate-in fade-in duration-500"
                : "space-y-3 animate-in fade-in duration-500"
            }
          >
            {filteredAssets.map((item: any) => (
              activeTab === "voices" ? 
                <GoogleQuantumVoiceCard key={item.id} item={item} canDelete={true} onDelete={() => setConfirmState({ title: `删除音色 ${item.name}?`, action: async () => { await fetchJSON(`/api/studio/voices/${item.id}`, { method: "DELETE" }); await syncLibrary(); } })} onView={() => openVoiceViewer(item)} /> :
              activeTab === "prompts" ?
                <PromptListCard
                  key={item.id}
                  item={item}
                  canDelete={true}
                  onView={() => openPromptViewer(item)}
                  onCopy={() => {
                    navigator.clipboard.writeText(asString(item.content));
                    toast.success("内容已复制");
                  }}
                  onDelete={() => setConfirmState({ title: `确认删除 ${item.title}?`, action: async () => { await fetchJSON(`/api/studio/prompts/${item.id}`, { method: "DELETE" }); await syncLibrary(); } })}
                />
              :
                <AssetGalleryCard key={item.id} type={activeTab} item={item} canDelete={activeTab === "styles"} onView={() => openAssetViewer(item, activeTab as "styles" | "characters" | "environments")} onCopy={() => { navigator.clipboard.writeText(JSON.stringify(item.spec || item.visualSpec || {}, null, 2)); toast.success("内容已复制"); }} onDelete={() => setConfirmState({ title: `确认删除 ${item.name || item.title}?`, action: async () => { await fetchJSON(`/api/studio/styles/${item.id}`, { method: "DELETE" }); await syncLibrary(); } })} />
            ))}
          </div>
        )}
      </div>

      {viewingPrompt ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-6xl rounded-[28px] bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
              <h3 className="text-lg font-black">查看提示词</h3>
              <button onClick={closePromptViewer} className="h-9 w-9 rounded-full hover:bg-zinc-100 flex items-center justify-center">
                <Plus size={20} className="rotate-45 text-zinc-500" />
              </button>
            </div>
            <div className="grid max-h-[85vh] grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/30 p-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-zinc-400">标题</label>
                  <input
                    value={promptEditorTitle}
                    onChange={(e) => setPromptEditorTitle(e.target.value)}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-zinc-400">内容</label>
                  <textarea
                    value={promptEditorContent}
                    onChange={(e) => setPromptEditorContent(e.target.value)}
                    className="h-[420px] w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-rose-400"
                  />
                </div>
                <button
                  onClick={() => void handleUpdatePrompt()}
                  disabled={promptSaving || !promptEditorTitle.trim()}
                  className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {promptSaving ? "保存中..." : "保存提示词"}
                </button>
              </div>

              <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/30 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-zinc-800">结果预览</h4>
                    {!showPromptPreviewPanel ? (
                      <p className="text-xs font-medium text-zinc-500">
                        默认隐藏生成配置，只有需要生成时再展开。
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2 self-start sm:self-auto">
                    <button
                      onClick={() =>
                        setShowPromptPreviewPanel((prev) => {
                          const next = !prev;
                          if (!next) setShowPromptPreviewConfig(false);
                          return next;
                        })
                      }
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      {showPromptPreviewPanel ? "收起预览工具" : "展开预览工具"}
                    </button>
                    {showPromptPreviewPanel ? (
                      <button
                        onClick={() => void handlePreviewPrompt()}
                        disabled={promptPreviewLoading || !promptEditorContent.trim() || !promptPreviewModel.trim()}
                        className="h-10 rounded-xl bg-zinc-900 px-3 text-xs font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {promptPreviewLoading ? "生成中..." : "生成结果预览"}
                      </button>
                    ) : null}
                  </div>
                </div>

                {showPromptPreviewPanel ? (
                  <>
                    <button
                      onClick={() => setShowPromptPreviewConfig((prev) => !prev)}
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      {showPromptPreviewConfig ? "收起预览配置" : "展开预览配置"}
                    </button>
                    {showPromptPreviewConfig ? (
                      <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase text-zinc-400">预览服务</label>
                        <select
                          value={promptPreviewProvider}
                          onChange={(event) => setPromptPreviewProvider(event.target.value as GenerationProvider)}
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400 focus:bg-white"
                        >
                          <option value="ollama">Ollama 服务</option>
                          <option value="gemini">Gemini 服务</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase text-zinc-400">预览模型</label>
                        <select
                          value={promptPreviewModel}
                          onChange={(event) => setPromptPreviewModel(event.target.value)}
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400 focus:bg-white"
                          disabled={loadingModels || promptProviderModels.length === 0}
                        >
                          {loadingModels ? <option value="">正在加载模型...</option> : null}
                          {!loadingModels && promptProviderModels.length === 0 ? <option value="">当前服务暂无文本模型</option> : null}
                          {!loadingModels
                            ? promptProviderModels.map((model) => (
                                <option key={model} value={model}>
                                  {model}
                                </option>
                              ))
                            : null}
                        </select>
                      </div>
                    </div>

                    {promptPreviewProvider === "gemini" ? (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase text-zinc-400">思考深度</label>
                        <select
                          value={promptGeminiThinkingLevel}
                          onChange={(event) => setPromptGeminiThinkingLevel(event.target.value as GeminiThinkingLevel)}
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400 focus:bg-white"
                        >
                          {(promptProviderCatalog?.thinking?.levelOptions?.length
                            ? promptProviderCatalog.thinking.levelOptions
                            : ["minimal", "low", "medium", "high"]
                          ).map((level) => (
                            <option key={level} value={level}>
                              {normalizeThinkingLevelLabel(level)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase text-zinc-400">思考模式</label>
                          <select
                            value={promptOllamaThinkMode}
                            onChange={(event) => setPromptOllamaThinkMode(event.target.value as OllamaThinkMode)}
                            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400 focus:bg-white"
                          >
                            <option value="none">不启用</option>
                            {promptProviderCatalog?.thinking?.supportsBoolean ? <option value="boolean">开关控制</option> : null}
                            {promptProviderCatalog?.thinking?.supportsString ? <option value="string">强度级别</option> : null}
                          </select>
                        </div>
                        {promptOllamaThinkMode === "boolean" ? (
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase text-zinc-400">开关状态</label>
                            <select
                              value={promptOllamaThinkBoolean ? "true" : "false"}
                              onChange={(event) => setPromptOllamaThinkBoolean(event.target.value === "true")}
                              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400 focus:bg-white"
                            >
                              <option value="true">开启</option>
                              <option value="false">关闭</option>
                            </select>
                          </div>
                        ) : null}
                        {promptOllamaThinkMode === "string" ? (
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-black uppercase text-zinc-400">思考强度</label>
                            <select
                              value={promptOllamaThinkString}
                              onChange={(event) => setPromptOllamaThinkString(event.target.value)}
                              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400 focus:bg-white"
                            >
                              {(promptProviderCatalog?.thinking?.stringSuggestions?.length
                                ? promptProviderCatalog.thinking.stringSuggestions
                                : ["low", "medium", "high"]
                              ).map((option) => (
                                <option key={option} value={option}>
                                  {option === "low" ? "低" : option === "medium" ? "中" : option === "high" ? "高" : option}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {modelsError ? <p className="text-xs font-semibold text-rose-500">模型清单加载失败：{modelsError}</p> : null}
                    {!modelsError && promptProviderWarning ? <p className="text-xs font-semibold text-amber-600">{promptProviderWarning}</p> : null}
                      </>
                    ) : null}
                  </>
                ) : null}

                <div className="space-y-1.5">
                  <textarea
                    value={promptPreviewResult}
                    onChange={(e) => setPromptPreviewResult(e.target.value)}
                    readOnly
                    className="h-[472px] w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700 outline-none"
                    placeholder="暂无预览结果"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Edit Modals & Create Modals (Purely implementation, no placeholders) */}
      {(viewingStyle || viewingCharacter || viewingEnvironment) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl rounded-[32px] bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-zinc-50/50"><h3 className="text-xl font-black">查看{editorLabel}</h3><button onClick={closeAssetViewer} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-zinc-100 transition-colors"><Plus size={24} className="rotate-45 text-zinc-400" /></button></div>
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div className="space-y-1.5"><label className="text-[11px] font-black uppercase text-zinc-400">名称</label><input value={styleEditorName} onChange={e => setStyleEditorName(e.target.value)} className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm font-bold focus:border-rose-400 outline-none" placeholder="资料名称" /></div>
                {viewingCharacter && (<div className="space-y-1.5"><label className="text-[11px] font-black uppercase text-zinc-400">角色性别</label><div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">{["男", "女", "未知"].map(g => <button key={g} onClick={() => setCharacterDraft(p => ({ ...p, gender: g }))} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${characterDraft.gender === g ? "bg-white text-rose-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"}`}>{g}</button>)}</div></div>)}
                <div className="space-y-1.5"><label className="text-[11px] font-black uppercase text-zinc-400">JSON 定义</label><JsonStyleEditor value={styleSpecInputText} onChange={setStyleSpecInputText} /></div>
                <button onClick={handleUpdate} className="w-full h-12 rounded-2xl bg-zinc-900 text-white font-bold hover:bg-rose-600 transition-all flex items-center justify-center gap-2">{styleSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />}保存并同步</button>
              </div>
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[11px] font-black uppercase text-zinc-400">预览参考图</label>
                  <button
                    onClick={() =>
                      setShowAssetPreviewTools((prev) => {
                        const next = !prev;
                        if (!next) setShowStyleGeminiConfig(false);
                        return next;
                      })
                    }
                    className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {showAssetPreviewTools ? "收起预览工具" : "展开预览工具"}
                  </button>
                </div>
                <div className="relative aspect-video rounded-3xl bg-zinc-50 overflow-hidden border-2 border-dashed border-zinc-200 flex items-center justify-center">
                  {stylePreviewImage ? <img src={stylePreviewImage} className="w-full h-full object-cover" /> : <div className="text-zinc-300 flex flex-col items-center gap-2"><ImageIcon size={48} strokeWidth={1} /><span className="text-xs font-bold">暂无预览图</span></div>}
                  {showAssetPreviewTools && stylePreviewMode === "upload" ? (
                    <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={() => styleFileInputRef.current?.click()} className="h-12 px-6 rounded-full bg-white text-zinc-900 font-bold shadow-xl">上传本地图片</button>
                    </div>
                  ) : null}
                </div>
                <input
                  ref={styleFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      await handleUploadStylePreview(f);
                    }
                  }}
                />
                {showAssetPreviewTools ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-1">
                      <button
                        onClick={() => {
                          setStylePreviewMode("upload");
                          setShowStyleGeminiConfig(false);
                        }}
                        className={`h-9 rounded-lg text-xs font-bold transition-all ${stylePreviewMode === "upload" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
                      >
                        本地上传
                      </button>
                      <button
                        onClick={() => {
                          setStylePreviewMode("gemini");
                          setShowStyleGeminiConfig(false);
                        }}
                        className={`h-9 rounded-lg text-xs font-bold transition-all ${stylePreviewMode === "gemini" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
                      >
                        Gemini 生成
                      </button>
                    </div>

                    {stylePreviewMode === "upload" ? (
                      <button
                        onClick={() => styleFileInputRef.current?.click()}
                        disabled={styleUploadLoading}
                        className="h-11 w-full rounded-xl border border-zinc-200 bg-white text-sm font-bold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {styleUploadLoading ? "上传中..." : "上传本地图片"}
                      </button>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-zinc-500">Gemini 将直接使用左侧 JSON 定义作为风格预览描述。</p>
                        <button
                          onClick={() => setShowStyleGeminiConfig((prev) => !prev)}
                          className="h-10 w-full rounded-xl border border-zinc-200 bg-white text-xs font-bold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                        >
                          {showStyleGeminiConfig ? "收起 Gemini 参数" : "展开 Gemini 参数"}
                        </button>
                        {showStyleGeminiConfig ? (
                          <>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-black uppercase text-zinc-400">Gemini 图片模型</label>
                                <select
                                  value={stylePreviewModel}
                                  onChange={(event) => setStylePreviewModel(event.target.value)}
                                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold outline-none focus:border-rose-400 focus:bg-white"
                                  disabled={loadingModels || geminiImageModels.length === 0}
                                >
                                  {loadingModels ? <option value="">正在加载模型...</option> : null}
                                  {!loadingModels && geminiImageModels.length === 0 ? <option value="">暂无可用图片模型</option> : null}
                                  {!loadingModels
                                    ? geminiImageModels.map((model) => (
                                        <option key={model} value={model}>
                                          {model}
                                        </option>
                                      ))
                                    : null}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-black uppercase text-zinc-400">画幅比例</label>
                                <select
                                  value={stylePreviewAspectRatio}
                                  onChange={(event) => setStylePreviewAspectRatio(event.target.value)}
                                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold outline-none focus:border-rose-400 focus:bg-white"
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
                              <label className="text-[11px] font-black uppercase text-zinc-400">输出尺寸</label>
                              <select
                                value={stylePreviewResolution}
                                onChange={(event) => setStylePreviewResolution(event.target.value)}
                                className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-semibold outline-none focus:border-rose-400 focus:bg-white"
                              >
                                {["1024x1024", "1280x720", "1920x1080", "1080x1920", "1536x1024", "1024x1536"].map((resolution) => (
                                  <option key={resolution} value={resolution}>
                                    {resolution}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {modelsError ? <p className="text-xs font-semibold text-rose-500">模型清单加载失败：{modelsError}</p> : null}
                            {!modelsError && geminiProviderWarning ? <p className="text-xs font-semibold text-amber-600">{geminiProviderWarning}</p> : null}
                          </>
                        ) : null}
                        {!styleSpecReadyForGemini ? <p className="text-xs font-semibold text-rose-500">JSON 定义为空或无效，请先填写后再生成。</p> : null}
                        <button
                          onClick={() => void handleGenerateStylePreview()}
                          disabled={stylePreviewLoading || !stylePreviewModel.trim() || !styleSpecReadyForGemini}
                          className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {stylePreviewLoading ? "生成中..." : "使用 Gemini 生成预览"}
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-xs font-semibold text-zinc-500">默认仅展示预览图，需要上传或生成时再展开预览工具。</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-[32px] bg-white shadow-2xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-zinc-50/50"><h3 className="text-xl font-black">新增资料项</h3><button onClick={() => setShowCreateModal(false)}><Plus size={24} className="rotate-45 text-zinc-400" /></button></div>
            <div className="p-8 space-y-6">
              <div className="flex gap-1 p-1 bg-zinc-100 rounded-2xl">{(Object.keys(ASSET_META) as AssetType[]).map(k => <button key={k} onClick={() => setCreateType(k)} className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${createType === k ? "bg-white text-rose-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"}`}>{ASSET_META[k].label}</button>)}</div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase text-zinc-400">
                      {createType === "prompts" ? "标题" : "基本信息"}
                    </label>
                    <input
                      value={
                        createType === "prompts"
                          ? promptDraft.title
                          : createType === "characters"
                            ? characterDraft.name
                            : createType === "styles"
                              ? styleDraft.name
                              : createType === "environments"
                                ? environmentDraft.name
                                : voiceDraft.name
                      }
                      onChange={e => {
                        const v = e.target.value;
                        if (createType === "prompts") setPromptDraft(p => ({ ...p, title: v }));
                        else if (createType === "characters") setCharacterDraft(p => ({ ...p, name: v }));
                        else if (createType === "styles") setStyleDraft(p => ({ ...p, name: v }));
                        else if (createType === "environments") setEnvironmentDraft(p => ({ ...p, name: v }));
                        else setVoiceDraft(p => ({ ...p, name: v }));
                      }}
                      className="h-12 w-full rounded-2xl border border-zinc-200 px-4 text-sm font-bold focus:border-rose-400 outline-none"
                      placeholder={createType === "prompts" ? "输入提示词标题..." : "输入名称..."}
                    />
                  </div>
                  {createType === "prompts" && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black uppercase text-zinc-400">提示词内容</label>
                      <textarea
                        value={promptDraft.content}
                        onChange={e => setPromptDraft(p => ({ ...p, content: e.target.value }))}
                        className="w-full h-36 rounded-2xl border border-zinc-200 p-4 text-xs font-mono focus:border-rose-400 outline-none"
                        placeholder="输入提示词内容..."
                      />
                    </div>
                  )}
                  {createType === "characters" && (<div className="space-y-1.5"><label className="text-[11px] font-black uppercase text-zinc-400">角色性别</label><div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">{["男", "女", "未知"].map(g => <button key={g} onClick={() => setCharacterDraft(p => ({ ...p, gender: g }))} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${characterDraft.gender === g ? "bg-white text-rose-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"}`}>{g}</button>)}</div></div>)}
                  {createType === "voices" && (<div className="space-y-1.5"><label className="text-[11px] font-black uppercase text-zinc-400">音色性别</label><div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">{["男", "女", "未知"].map(g => <button key={g} onClick={() => setVoiceDraft(p => ({ ...p, gender: g }))} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${voiceDraft.gender === g ? "bg-white text-rose-600 shadow-sm" : "text-zinc-400 hover:text-zinc-600"}`}>{g}</button>)}</div></div>)}
                  {createType === "styles" && (<div className="space-y-1.5"><label className="text-[11px] font-black uppercase text-zinc-400">JSON 定义内容</label><textarea value={styleDraft.content} onChange={e => setStyleDraft(p => ({ ...p, content: e.target.value }))} className="w-full h-32 rounded-2xl border border-zinc-200 p-4 text-xs font-mono focus:border-rose-400 outline-none" placeholder='{"风格":"动漫"}' /></div>)}
                </div>
              <button onClick={handleCreate} disabled={creating || !createValid} className="w-full h-14 rounded-2xl bg-zinc-900 text-white font-bold hover:bg-rose-600 transition-all flex items-center justify-center gap-2">{creating ? <Loader2 className="animate-spin" /> : <Plus size={20} />}立即创建</button>
            </div>
          </div>
        </div>
      )}

      {viewingVoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-6xl rounded-[32px] bg-white shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between border-b border-zinc-200 bg-zinc-50/60 px-6 py-5">
              <div>
                <h3 className="text-xl font-black text-zinc-900">查看配音音色</h3>
                <p className="mt-1 text-xs font-semibold text-zinc-500">左侧维护音色档案与样本，右侧生成并试听预览结果。</p>
              </div>
              <button onClick={closeVoiceViewer} className="h-10 w-10 rounded-full hover:bg-zinc-100 flex items-center justify-center">
                <Plus size={24} className="rotate-45 text-zinc-400" />
              </button>
            </div>

            <div className="grid max-h-[85vh] grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-2">
              <section className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/30 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-black text-zinc-900">音色档案</h4>
                  <button
                    onClick={() => void handleSaveVoiceProfile()}
                    disabled={voiceProfileSaving || !voiceEditorName.trim() || !voiceEditorVoiceID.trim()}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {voiceProfileSaving ? "保存中..." : "保存资料"}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase text-zinc-400">音色名称</label>
                  <input
                    value={voiceEditorName}
                    onChange={(event) => setVoiceEditorName(event.target.value)}
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400"
                    placeholder="输入音色名称"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase text-zinc-400">性别</label>
                    <div className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1">
                      {["男", "女", "未知"].map((gender) => (
                        <button
                          key={gender}
                          onClick={() => setVoiceEditorGender(gender)}
                          className={`h-8 rounded-lg text-xs font-bold transition-all ${voiceEditorGender === gender ? "bg-white text-rose-600 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
                        >
                          {gender}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase text-zinc-400">音色 ID</label>
                    <input
                      value={voiceEditorVoiceID}
                      onChange={(event) => setVoiceEditorVoiceID(event.target.value)}
                      className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400"
                      placeholder="例如: voice-001"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase text-zinc-400">音色引擎</label>
                    <input
                      value={voiceEditorProvider}
                      onChange={(event) => setVoiceEditorProvider(event.target.value)}
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-xs font-bold text-zinc-600 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase text-zinc-400">发布时间</label>
                    <div className="flex h-10 items-center rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-xs font-bold text-zinc-600">
                      {formatPublishDate(viewingVoice.publishedAt)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleVoiceSamplePlay}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800"
                      >
                        {voiceSampleIsPlaying ? (
                          <span className="flex items-center gap-1.5">
                            <span className="h-3.5 w-1 rounded-full bg-white" />
                            <span className="h-3.5 w-1 rounded-full bg-white" />
                          </span>
                        ) : (
                          <span
                            className="ml-0.5 block h-0 w-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-white"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                      <span className="text-sm font-black text-zinc-700">
                        {formatAudioDuration((voiceSampleDuration ?? 0) * voiceSampleProgress)} / {formatAudioDuration(voiceSampleDuration)}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-zinc-400">当前样本波形</span>
                  </div>
                  <div className="h-20 w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950">
                    <GoogleQuantumWaveform
                      url={voiceSampleAudioUrl || getVoiceSampleAudioUrl(viewingVoice)}
                      isPlaying={voiceSampleIsPlaying}
                      progress={voiceSampleProgress}
                      onSeek={seekVoiceSample}
                      className="h-full w-full"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
                    <span>{voiceSampleAudioUrl || getVoiceSampleAudioUrl(viewingVoice) ? "点击波形可定位播放进度" : "暂无样本音频"}</span>
                    <span>{Math.round(voiceSampleProgress * 100)}%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    ref={voiceSampleFileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (file) await handleUploadVoiceSample(file);
                    }}
                  />
                  <button
                    onClick={() => voiceSampleFileInputRef.current?.click()}
                    disabled={voiceSampleUploadLoading}
                    className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {voiceSampleUploadLoading ? "上传中..." : "上传并覆盖样本音频"}
                  </button>
                  {voiceSampleAudioUrl || getVoiceSampleAudioUrl(viewingVoice) ? (
                    <a
                      href={voiceSampleAudioUrl || getVoiceSampleAudioUrl(viewingVoice)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-700"
                    >
                      <Link2 size={12} />
                      打开样本音频地址
                    </a>
                  ) : null}
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-black text-zinc-900">预览生成</h4>
                    {!showVoicePreviewTools ? <p className="text-xs font-semibold text-zinc-500">默认收起，展开后可配置并生成预览。</p> : null}
                  </div>
                  <button
                    onClick={() =>
                      setShowVoicePreviewTools((prev) => {
                        const next = !prev;
                        if (!next) setShowVoicePreviewConfig(false);
                        return next;
                      })
                    }
                    className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    {showVoicePreviewTools ? "收起预览工具" : "展开预览工具"}
                  </button>
                </div>

                {showVoicePreviewTools ? (
                  <>
                    <button
                      onClick={() => setShowVoicePreviewConfig((prev) => !prev)}
                      className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      {showVoicePreviewConfig ? "收起高级配置" : "展开高级配置"}
                    </button>

                    {showVoicePreviewConfig ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase text-zinc-400">预览服务器地址</label>
                          <input
                            value={voicePreviewServerUrl}
                            onChange={(event) => setVoicePreviewServerUrl(event.target.value)}
                            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400"
                            placeholder="可选，留空使用默认 IndexTTS"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase text-zinc-400">模型名称</label>
                          <input
                            value={voicePreviewModel}
                            onChange={(event) => setVoicePreviewModel(event.target.value)}
                            className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold outline-none focus:border-rose-400"
                            placeholder="可选，例如 indextts-v1"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black uppercase text-zinc-400">输入文本（最多 20 个字）</label>
                        <span className="text-xs font-bold text-zinc-400">{voicePreviewText.length}/20</span>
                      </div>
                      <textarea
                        value={voicePreviewText}
                        onChange={(event) => setVoicePreviewText(event.target.value.slice(0, 20))}
                        className="h-28 w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none focus:border-rose-400"
                        placeholder="例如：今晚故事，从这扇门开始。"
                      />
                    </div>

                    <button
                      onClick={() => void handleGenerateVoicePreview()}
                      disabled={voicePreviewLoading || !voicePreviewText.trim()}
                      className="h-11 w-full rounded-xl bg-zinc-900 text-sm font-bold text-white transition-colors hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {voicePreviewLoading ? "生成中..." : "生成预览音频"}
                    </button>
                  </>
                ) : null}

                <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleVoicePreviewPlay}
                        disabled={!voicePreviewAudioUrl}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {voicePreviewIsPlaying ? (
                          <span className="flex items-center gap-1.5">
                            <span className="h-3.5 w-1 rounded-full bg-white" />
                            <span className="h-3.5 w-1 rounded-full bg-white" />
                          </span>
                        ) : (
                          <span
                            className="ml-0.5 block h-0 w-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-white"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                      <span className="text-sm font-black text-zinc-700">
                        {formatAudioDuration((voicePreviewDuration ?? 0) * voicePreviewProgress)} / {formatAudioDuration(voicePreviewDuration)}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-zinc-400">预览音频波形</span>
                  </div>
                  <div className="h-20 w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950">
                    {voicePreviewAudioUrl ? (
                      <GoogleQuantumWaveform
                        url={voicePreviewAudioUrl}
                        isPlaying={voicePreviewIsPlaying}
                        progress={voicePreviewProgress}
                        onSeek={seekVoicePreview}
                        className="h-full w-full"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-semibold text-zinc-400">
                        暂无预览音频，生成后可在此试听
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
                    <span>{voicePreviewAudioUrl ? "点击波形可定位播放进度" : "等待预览生成结果"}</span>
                    <span>{Math.round(voicePreviewProgress * 100)}%</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={Boolean(confirmState)} title={confirmState?.title ?? ""} confirmText="确认删除" danger loading={confirmLoading} onCancel={() => setConfirmState(null)} onConfirm={async () => { setConfirmLoading(true); try { await confirmState?.action(); toast.success("删除成功"); } catch { toast.error("删除失败"); } finally { setConfirmLoading(false); setConfirmState(null); } }} />
    </div>
  );
}

// --- Specialized Internal Auth ---
async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!r.ok) {
    const payload = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || `Request failed (${r.status})`);
  }
  return r.json() as Promise<T>;
}

async function recoverSessionAfterUnauthorized() { return "login"; }
async function shouldRedirectToLoginOnUnauthorized() { return true; }
async function readSessionProbe() { return null; }
function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }
