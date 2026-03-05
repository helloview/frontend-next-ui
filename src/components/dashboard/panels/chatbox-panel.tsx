"use client";

/* eslint-disable @next/next/no-img-element */

import {
  Bot,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  ImageIcon,
  Loader2,
  Send,
  Sparkles,
  Trash2,
  Plus,
  Zap,
  MessageSquare,
  Image as ImageIconLucide,
  X,
  Cpu,
  Check,
  Search,
  MessageCirclePlus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type {
  ChatboxContentType,
  ChatboxConversation,
  ChatboxConversationListResponse,
  ChatboxMessage,
  ChatboxMessageListResponse,
  ChatboxModelsResponse,
  ChatboxProvider,
  ChatboxSendMessageResponse,
} from "@/types/chatbox";

const PROVIDER_LABELS: Record<ChatboxProvider, string> = {
  gemini: "Gemini",
  ollama: "Ollama",
};

// --- Helpers ---
type SSEEvent = { event: string; data: string; };
function getString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function getChunkString(value: unknown): string { return typeof value === "string" ? value : ""; }
async function parseJSON<T>(response: Response): Promise<T | null> { return (await response.json().catch(() => null)) as T | null; }
function parseJSONString<T>(raw: string): T | null { try { return JSON.parse(raw) as T; } catch { return null; } }
function resolveErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  return getString(record.error) || getString(record.details) || fallback;
}
function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function dedupeStrings(values: string[]): string[] { return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))); }
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return dedupeStrings(value.filter((item): item is string => typeof item === "string"));
  if (typeof value === "string") return dedupeStrings(value.split(","));
  return [];
}
function normalizeProviderCatalog(payload: unknown) {
  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const textModels = dedupeStrings(toStringArray(record.textModels ?? record.text_models));
  const imageModels = dedupeStrings(toStringArray(record.imageModels ?? record.image_models));
  return { textModels, imageModels, defaultTextModel: getString(record.defaultTextModel ?? record.default_text_model) || textModels[0] || "", defaultImageModel: getString(record.defaultImageModel ?? record.default_image_model) || imageModels[0] || "" };
}
function normalizeProviderValue(value: unknown): ChatboxProvider { return value === "ollama" ? "ollama" : "gemini"; }
function normalizeContentTypeValue(value: unknown): ChatboxContentType { return value === "image" ? "image" : "text"; }
function normalizeModelsPayload(payload: unknown): ChatboxModelsResponse | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const providersRecord = record.providers && typeof record.providers === "object" ? (record.providers as Record<string, unknown>) : {};
  const gemini = normalizeProviderCatalog(providersRecord.gemini ?? record.gemini);
  const ollama = normalizeProviderCatalog(providersRecord.ollama ?? record.ollama);
  if (gemini.textModels.length === 0 && ollama.textModels.length === 0) return null;
  return { providers: { gemini, ollama }, warnings: [] };
}
function buildStaticFallbackModels(): ChatboxModelsResponse {
  return { providers: { gemini: { textModels: ["gemini-2.5-flash"], imageModels: ["gemini-2.5-flash-image"], defaultTextModel: "gemini-2.5-flash", defaultImageModel: "gemini-2.5-flash-image" }, ollama: { textModels: ["deepseek-v3.1:671b-cloud"], imageModels: [], defaultTextModel: "deepseek-v3.1:671b-cloud", defaultImageModel: "" } }, warnings: [] };
}
function getAvailableModels(models: ChatboxModelsResponse | null, provider: ChatboxProvider, contentType: ChatboxContentType): string[] {
  const catalog = models?.providers?.[provider] ?? { textModels: [], imageModels: [] };
  return contentType === "image" ? catalog.imageModels : catalog.textModels;
}
function resolveDefaultModel(models: ChatboxModelsResponse | null, provider: ChatboxProvider, contentType: ChatboxContentType): string {
  const catalog = models?.providers?.[provider] ?? { textModels: [], imageModels: [], defaultTextModel: "", defaultImageModel: "" };
  if (contentType === "image") return catalog.defaultImageModel || catalog.imageModels[0] || "";
  return catalog.defaultTextModel || catalog.textModels[0] || "";
}
function imageSource(message: ChatboxMessage): string {
  if (message.image_url) return message.image_url;
  if (message.image_base64) return `data:image/png;base64,${message.image_base64}`;
  return "";
}
function parseSSEEvent(rawEvent: string): SSEEvent | null {
  const normalized = rawEvent.replace(/\r/g, "").trim();
  if (!normalized) return null;
  const lines = normalized.split("\n");
  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) eventName = getString(line.slice("event:".length)) || "message";
    else if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trimStart());
  }
  return dataLines.length === 0 ? null : { event: eventName, data: dataLines.join("\n") };
}
function makeTempID(prefix: string): string { return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`; }

export function ChatboxPanel({ userAvatar }: { userAvatar?: string }) {
  const [isBooting, setBooting] = useState(true);
  const [isCreatingConversation, setCreatingConversation] = useState(false);
  const [isLoadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setSending] = useState(false);

  const [models, setModels] = useState<ChatboxModelsResponse | null>(null);
  const [conversations, setConversations] = useState<ChatboxConversation[]>([]);
  const [messages, setMessages] = useState<ChatboxMessage[]>([]);
  const [activeConversationID, setActiveConversationID] = useState<number | null>(null);

  const [provider, setProvider] = useState<ChatboxProvider>("gemini");
  const [contentType, setContentType] = useState<ChatboxContentType>("text");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [expandedThinkingIDs, setExpandedThinkingIDs] = useState<Record<string, boolean>>({});
  
  const [isActionMenuOpen, setActionMenuOpen] = useState(false);
  const [isModelModalOpen, setModelModalOpen] = useState(false);
  const [isHistoryOpen, setHistoryOpen] = useState(false);

  const messagesBottomRef = useRef<HTMLDivElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  const availableModels = useMemo(() => getAvailableModels(models, provider, contentType), [contentType, models, provider]);
  const activeConversation = useMemo(() => conversations.find((item) => item.id === activeConversationID) ?? null, [activeConversationID, conversations]);

  const bootstrap = async () => {
    setBooting(true);
    try {
      const modelsRes = await fetch("/api/chatbox/models", { cache: "no-store" });
      const modelsRawPayload = await parseJSON<Record<string, unknown>>(modelsRes);
      let modelsPayload = modelsRes.ok ? normalizeModelsPayload(modelsRawPayload) : null;
      if (!modelsPayload) modelsPayload = buildStaticFallbackModels();
      setModels(modelsPayload);

      const conversationsRes = await fetch("/api/chatbox/conversations", { cache: "no-store" });
      const conversationsPayload = await parseJSON<ChatboxConversationListResponse>(conversationsRes);
      const nextConversations = conversationsPayload?.items ?? [];
      setConversations(nextConversations);

      if (nextConversations.length > 0) {
        const first = nextConversations[0];
        setActiveConversationID(first.id);
        const np = normalizeProviderValue(first.provider);
        const nct = normalizeContentTypeValue(first.content_type);
        setProvider(np);
        setContentType(nct);
        setModel(first.model || resolveDefaultModel(modelsPayload, np, nct));
        await loadMessages(first.id);
      }
    } catch { toast.error("初始化失败"); }
    finally { setBooting(false); }
  };

  useEffect(() => { void bootstrap(); }, []);
  useEffect(() => { messagesBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) setActionMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const upsertConversationOnTop = (conversation: ChatboxConversation) => {
    if (!conversation?.id) return;
    setConversations((previous) => {
      const rest = previous.filter((item) => item?.id && item.id !== conversation.id);
      return [conversation, ...rest];
    });
  };

  const loadMessages = useCallback(async (id: number) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chatbox/conversations/${id}/messages`, { cache: "no-store" });
      const payload = await parseJSON<ChatboxMessageListResponse>(res);
      setMessages(payload?.items ?? []);
    } catch { setMessages([]); }
    finally { setLoadingMessages(false); }
  }, []);

  useEffect(() => {
    if (!activeConversationID) {
      return;
    }
    const hasStreamingMessage = messages.some((item) => item.status === "streaming");
    if (!hasStreamingMessage) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadMessages(activeConversationID);
    }, 2500);

    return () => {
      window.clearInterval(timer);
    };
  }, [activeConversationID, loadMessages, messages]);

  const createConversation = async () => {
    setCreatingConversation(true);
    try {
      const res = await fetch("/api/chatbox/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, content_type: contentType }),
      });
      const payload = await parseJSON<ChatboxConversation>(res);
      if (res.ok && payload) {
        upsertConversationOnTop(payload);
        setActiveConversationID(payload.id);
        setMessages([]);
        setHistoryOpen(false);
        return payload;
      }
    } catch { toast.error("创建失败"); }
    finally { setCreatingConversation(false); }
    return null;
  };

  const handleSelectConversation = async (c: ChatboxConversation) => {
    if (!c?.id) return;
    setActiveConversationID(c.id);
    const np = normalizeProviderValue(c.provider);
    const nct = normalizeContentTypeValue(c.content_type);
    setProvider(np);
    setContentType(nct);
    setModel(c.model || resolveDefaultModel(models, np, nct));
    setHistoryOpen(false);
    await loadMessages(c.id);
  };

  const sendMessageStream = async (cid: number, content: string) => {
    const tempUserID = makeTempID("t-u");
    const tempAssistantID = makeTempID("t-a");
    setMessages(prev => [...prev, 
      { id: tempUserID, conversation_id: cid, role: "user", content_type: "text", content, created_at: new Date().toISOString() } as ChatboxMessage,
      { id: tempAssistantID, conversation_id: cid, role: "assistant", content_type: "text", content: "", thinking: "", created_at: new Date().toISOString() } as ChatboxMessage
    ]);

    const res = await fetch(`/api/chatbox/conversations/${cid}/messages/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, provider, model, content_type: "text" }),
    });

    if (!res.ok || !res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalPayload: ChatboxSendMessageResponse | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true }).replace(/\r/g, "");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const parsed = parseSSEEvent(buffer.slice(0, boundary));
        if (parsed?.event === "token") {
          const chunk = parseJSONString<{ content?: string }>(parsed.data)?.content || "";
          setMessages(prev => prev.map(m => m.id === tempAssistantID ? { ...m, content: m.content + chunk } : m));
        } else if (parsed?.event === "thinking") {
          const chunk = parseJSONString<{ thinking?: string }>(parsed.data)?.thinking || "";
          setMessages(prev => prev.map(m => m.id === tempAssistantID ? { ...m, thinking: (m.thinking || "") + chunk } : m));
        } else if (parsed?.event === "done") {
          finalPayload = parseJSONString<ChatboxSendMessageResponse>(parsed.data);
        }
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
      if (done) break;
    }

    if (finalPayload?.conversation) {
      upsertConversationOnTop(finalPayload.conversation);
      setMessages(prev => prev.map(m => m.id === tempUserID ? finalPayload!.user_message : m.id === tempAssistantID ? finalPayload!.assistant_message : m));
    }
  };

  const markTempAssistantFailed = (id: string, msg: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, status: "failed", error: msg, content: m.content || msg } : m
      )
    );
  };

  const handleSend = async () => {
    const content = prompt.trim();
    if (!content || isSending) return;
    setSending(true); setPrompt("");
    
    let tempAssistantID = "";
    try {
      let cid = activeConversationID;
      if (!cid) cid = (await createConversation())?.id ?? null;
      if (!cid) {
        setSending(false);
        return;
      }

      if (contentType === "text") {
        await sendMessageStream(cid, content);
      } else {
        const tempUserID = makeTempID("t-u");
        tempAssistantID = makeTempID("t-a");
        
        setMessages(prev => [...prev, 
          { id: tempUserID, conversation_id: cid, role: "user", content_type: "text", content, created_at: new Date().toISOString() } as ChatboxMessage,
          { id: tempAssistantID, conversation_id: cid, role: "assistant", content_type: "image", content: "", image_url: "", image_base64: "", created_at: new Date().toISOString() } as ChatboxMessage
        ]);

        const res = await fetch(`/api/chatbox/conversations/${cid}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, provider, model, content_type: contentType }),
        });
        
        const payload = await parseJSON<ChatboxSendMessageResponse>(res);
        
        if (res.ok && payload?.conversation) {
          upsertConversationOnTop(payload.conversation);
          setMessages(prev => prev.map(m => 
            m.id === tempUserID ? payload.user_message : 
            m.id === tempAssistantID ? payload.assistant_message : m
          ));
        } else {
          const errorMsg = resolveErrorMessage(payload, `请求失败 (${res.status})`);
          markTempAssistantFailed(tempAssistantID, errorMsg);
          toast.error(errorMsg);
        }
      }
    } catch (err) { 
      const errorMsg = err instanceof Error ? err.message : "网络连接异常";
      if (tempAssistantID) {
        markTempAssistantFailed(tempAssistantID, errorMsg);
      }
      toast.error(errorMsg); 
      setPrompt(content); 
    } finally { 
      setSending(false); 
    }
  };

  const handleDeleteConversation = async (id: number) => {
    try {
      const res = await fetch(`/api/chatbox/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConversationID === id) {
          setActiveConversationID(null);
          setMessages([]);
        }
        toast.success("会话已删除");
      }
    } catch { toast.error("删除会话失败"); }
  };

  const handleDeleteMessage = async (id: string | number) => {
    // 1. 如果是正在发送的临时消息，直接从视图移除即可
    if (typeof id === "string" && id.startsWith("t-")) {
      setMessages(prev => prev.filter(m => m.id !== id));
      return;
    }

    // 2. 如果是已持久化的消息，调用后端接口进行物理删除
    try {
      if (!activeConversationID) return;
      const res = await fetch(`/api/chatbox/conversations/${activeConversationID}/messages/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== id));
        toast.success("消息已永久删除");
      } else {
        throw new Error();
      }
    } catch {
      toast.error("删除消息失败");
    }
  };

  const toggleThinking = (messageID: string) => {
    setExpandedThinkingIDs((previous) => ({
      ...previous,
      [messageID]: !previous[messageID],
    }));
  };

  if (isBooting) return (
    <div className="flex flex-1 items-center justify-center bg-white dark:bg-zinc-950">
      <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
    </div>
  );

  return (
    <div className="flex flex-col flex-1 h-full bg-white dark:bg-zinc-950 relative overflow-hidden font-sans">
      {/* Immersive Header */}
      <header className="flex h-16 items-center justify-between px-4 sm:px-8 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl z-30">
        <button 
          onClick={() => setHistoryOpen(!isHistoryOpen)}
          className="flex items-center gap-3 px-4 py-2 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <MessageSquare className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 group-hover:text-rose-500 transition-colors">Conversation</span>
            <div className="flex items-center gap-1.5 max-w-[180px] sm:max-w-[400px]">
              <span className="text-[15px] font-black text-zinc-900 dark:text-zinc-100 truncate">{activeConversation?.title || "新建对话"}</span>
              <ChevronDown className={`h-3.5 w-3.5 text-zinc-400 transition-transform duration-300 ${isHistoryOpen ? "rotate-180" : ""}`} />
            </div>
          </div>
        </button>

        <button 
          onClick={() => void createConversation()}
          className="flex h-10 w-10 sm:w-auto sm:px-4 items-center justify-center gap-2 rounded-xl bg-rose-500 text-white text-xs font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/10"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">新会话</span>
        </button>
      </header>

      {/* History Drawer Overlay */}
      {isHistoryOpen && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-zinc-950/10 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setHistoryOpen(false)} />
          <div className="absolute inset-x-0 top-0 bg-white dark:bg-zinc-950 border-b border-zinc-100 dark:border-zinc-800 shadow-2xl max-h-[70%] flex flex-col animate-in slide-in-from-top-4 duration-300">
            <div className="p-6 border-b border-zinc-50 dark:border-zinc-900 flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <input placeholder="搜索历史..." className="w-full bg-zinc-100 dark:bg-zinc-900 border-none rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:ring-2 ring-rose-500/20" />
              </div>
              <button onClick={() => setHistoryOpen(false)} className="p-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {conversations.map(c => (
                <div key={c.id} onClick={() => handleSelectConversation(c)} className={`group relative p-5 rounded-[32px] border-2 cursor-pointer transition-all ${c.id === activeConversationID ? "border-rose-500 bg-rose-50/20" : "border-zinc-50 dark:border-zinc-900 hover:border-zinc-200 bg-zinc-50/50 dark:bg-zinc-900/50"}`}>
                  <div className="text-[14px] font-black text-zinc-900 dark:text-zinc-100 truncate">{c.title || "未命名会话"}</div>
                  <p className="text-xs text-zinc-500 truncate mt-1 pr-8">{c.last_message_preview || "尚未开始..."}</p>
                  
                  {/* Delete Conversation Button */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(c.id); }}
                    className="absolute right-4 bottom-4 p-2 opacity-0 group-hover:opacity-100 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-50 transition-all shadow-sm"
                    title="删除会话"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Message Area */}
      <div className="flex-1 overflow-y-auto hide-scrollbar scroll-smooth">
        <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
          {messages.length === 0 && !isLoadingMessages && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
              <div className="h-20 w-20 rounded-[35%] bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center shadow-inner">
                <Sparkles className="h-10 w-10 text-rose-500" />
              </div>
              <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-white">有什么可以帮您的？</h2>
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            const renderAsImage = !isUser && m.content_type === "image";
            
            return (
              <div key={String(m.id)} className={`flex w-full ${isUser ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-500 group/msg`}>
                <div className={`flex max-w-[90%] gap-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-lg overflow-hidden ${isUser ? "" : "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"}`}>
                    {isUser ? (
                      <img src={userAvatar} alt="Me" className="h-full w-full object-cover" />
                    ) : (
                      <Bot className="h-5 w-5" />
                    )}
                  </div>

                  <div className={`flex-1 min-w-0 space-y-2 ${isUser ? "text-right" : "text-left"}`}>
                    <div className="relative group/content inline-block max-w-full">
                      {renderAsImage ? (
                        <div className="inline-block p-2 bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-100 dark:border-zinc-800 shadow-2xl">
                          {imageSource(m) ? (
                            <img src={imageSource(m)} alt="AI" className="max-h-[500px] w-full rounded-[24px] object-contain" />
                          ) : (
                            typeof m.id === "string" && m.id.startsWith("t-") ? (
                              <div className="flex h-48 w-80 items-center justify-center text-xs font-bold text-zinc-400 italic">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在构思画面...
                              </div>
                            ) : (
                              <div className="flex flex-col h-48 w-80 items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-950 rounded-[24px]">
                                <div className="p-3 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm">
                                  <ImageIcon className="h-6 w-6 text-zinc-300" />
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">图片生成未成功</span>
                                  {m.error && <span className="text-[10px] text-rose-400/60 max-w-[200px] truncate">{m.error}</span>}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <div className={`inline-block text-[15px] leading-relaxed font-medium transition-all ${isUser ? "bg-zinc-100 dark:bg-zinc-900 px-6 py-4 rounded-[28px] text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-800 dark:text-zinc-200"}`}>
                          {(!m.content && !isUser && typeof m.id === "string" && m.id.startsWith("t-")) ? (
                            <div className="flex items-center gap-2 py-1 px-2">
                              <div className="flex gap-1">
                                <div className="h-1.5 w-1.5 bg-rose-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="h-1.5 w-1.5 bg-rose-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="h-1.5 w-1.5 bg-rose-500 rounded-full animate-bounce"></div>
                              </div>
                              <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest">Thinking</span>
                            </div>
                          ) : (
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:rounded-2xl prose-pre:p-5 prose-code:text-rose-600 dark:prose-code:text-rose-400 prose-code:bg-rose-50 dark:prose-code:bg-rose-900/20 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-lg prose-code:before:content-none prose-code:after:content-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {m.content || m.error || ""}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Delete Message Button */}
                      <button 
                        onClick={() => handleDeleteMessage(m.id)}
                        className={`absolute top-0 opacity-0 group-hover/msg:opacity-100 p-1.5 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-50 transition-all z-10 ${isUser ? "-left-10" : "-right-10"}`}
                        title="删除消息"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {!isUser && m.thinking && (
                      <div className="max-w-2xl overflow-hidden rounded-[24px] border border-amber-100/50 bg-amber-50/10 dark:border-amber-900/20 mt-2">
                        <button
                          onClick={() => toggleThinking(String(m.id))}
                          className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-amber-700/70 flex items-center justify-between w-full hover:bg-amber-50/50 transition-colors"
                        >
                          <span className="flex items-center gap-2"><BrainCircuit className="h-3.5 w-3.5" /> Reasoning</span>
                          {expandedThinkingIDs[String(m.id)] ?? true ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                        {(expandedThinkingIDs[String(m.id)] ?? true) && (
                          <div className="px-5 pb-4 text-[13px] leading-relaxed text-amber-800/80 dark:text-amber-200/60 border-t border-amber-100/30 pt-3">
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-strong:text-amber-900 dark:prose-strong:text-amber-200">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {m.thinking}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesBottomRef} />
        </div>
      </div>

      {/* Floating Input Footer - Redesigned Shadow & Borders */}
      <footer className="px-4 pb-8 pt-2 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-zinc-950 dark:via-zinc-950/80">
        <div className="max-w-4xl mx-auto relative">
          {/* Action Menu */}
          {isActionMenuOpen && (
            <div ref={actionMenuRef} className="absolute bottom-full left-0 mb-4 w-60 overflow-hidden rounded-[32px] border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl animate-in slide-in-from-bottom-2">
              <div className="p-3 space-y-1">
                <button onClick={() => { setContentType("text"); setActionMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold transition-all ${contentType === "text" ? "bg-zinc-950 text-white" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>
                  <MessageSquare className="h-4 w-4" /> 文本模式
                </button>
                <button onClick={() => { setContentType("image"); setActionMenuOpen(false); }} disabled={provider === "ollama"} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold disabled:opacity-30 ${contentType === "image" ? "bg-zinc-950 text-white" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>
                  <ImageIconLucide className="h-4 w-4" /> 智能生图
                </button>
              </div>
              <div className="border-t border-zinc-50 dark:border-zinc-800 p-3 flex gap-2">
                {(["gemini", "ollama"] as const).map(p => (
                  <button key={p} onClick={() => { setProvider(p); setActionMenuOpen(false); }} className={`flex-1 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all ${provider === p ? "bg-rose-500 text-white shadow-lg" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* New Input Styling: Subtle Shadow and Clean Border */}
          <div className="relative flex flex-col rounded-[32px] border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all focus-within:border-rose-400 focus-within:shadow-[0_8px_30px_rgba(244,63,94,0.08)]">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
              rows={1}
              placeholder={contentType === "image" ? "描述您的创意..." : "有什么可以帮您的？"}
              className="hide-scrollbar max-h-48 w-full resize-none bg-transparent px-6 py-5 text-[15px] font-medium text-zinc-900 dark:text-zinc-100 outline-none placeholder:text-zinc-400"
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-1.5">
                <button onClick={() => setActionMenuOpen(!isActionMenuOpen)} className={`h-10 w-10 flex items-center justify-center rounded-full transition-all ${isActionMenuOpen ? "bg-zinc-950 text-white rotate-45" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                  <Plus className="h-5 w-5" />
                </button>
                <div className="h-5 w-[1px] bg-zinc-100 dark:bg-zinc-800 mx-1" />
                
                {/* Fixed Model Capsule: Full name and better UI */}
                <button onClick={() => setModelModalOpen(true)} className="flex items-center gap-2 rounded-full border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-2 hover:border-rose-300 transition-all group max-w-[240px]">
                  <Zap className={`h-3.5 w-3.5 shrink-0 ${contentType === "image" ? "text-amber-500" : "text-rose-500"}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-zinc-100 truncate">
                    {model || "选择模型"}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0 text-zinc-300" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={!prompt.trim() || isSending}
                className={`h-11 w-11 flex items-center justify-center rounded-full transition-all ${!prompt.trim() || isSending ? "bg-zinc-50 text-zinc-300 dark:bg-zinc-800 dark:text-zinc-700" : "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:scale-105 active:scale-95"}`}
              >
                {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Model Selector Modal - Improved naming and layout */}
      {isModelModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-zinc-950/20 backdrop-blur-md" onClick={() => setModelModalOpen(false)} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-[45px] border border-zinc-100 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 animate-in zoom-in-95">
            <div className="p-8 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight">选择模型</h3>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mt-1">Provider: {provider}</p>
              </div>
              <button onClick={() => setModelModalOpen(false)} className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-full text-zinc-400"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-4 pb-8 space-y-2">
              {availableModels.map((m) => (
                <button key={m} onClick={() => { setModel(m); setModelModalOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-[30px] border-2 transition-all ${m === model ? "border-rose-500 bg-rose-50/30" : "border-zinc-50 dark:border-zinc-900 hover:border-zinc-200 bg-white dark:bg-zinc-900"}`}>
                  <div className={`h-10 w-10 flex items-center justify-center rounded-2xl ${m === model ? "bg-rose-500 text-white" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"}`}>
                    {m.includes("flash") ? <Zap className="h-5 w-5" /> : <BrainCircuit className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="text-[14px] font-black text-zinc-900 dark:text-white truncate">{m}</div>
                    <div className="text-[9px] font-black uppercase tracking-tighter text-zinc-400">{m.includes("flash") ? "Optimized" : "Pro Reasoning"}</div>
                  </div>
                  {m === model && <Check className="h-5 w-5 text-rose-500 stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
