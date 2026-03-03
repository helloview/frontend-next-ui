"use client";

import {
  AlignLeft,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Circle,
  Edit2,
  Flag,
  Flame,
  GanttChart,
  LayoutList,
  ListTodo,
  Loader2,
  RefreshCw,
  Trash2,
  Trophy,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  buildLocalTodoHeatmap,
  buildLocalTodoSummary,
  generateLocalTodoID,
  loadTodoOfflineSnapshot,
  mergeTodoItems,
  queueTodoOfflineOperation,
  replaceTodoItem,
  saveTodoOfflineSnapshot,
  sortOpenTodoItems,
  type TodoOfflineOperation,
  type TodoOfflineSnapshot,
} from "@/lib/todo-offline";
import type { TodoHeatmap, TodoItem, TodoSummary } from "@/types/todo";

const PRIORITY_MAP = {
  0: { label: "无", color: "bg-zinc-100 text-zinc-500 border-zinc-200/60" },
  1: { label: "低", color: "bg-sky-50 text-sky-600 border-sky-200/60" },
  2: { label: "中", color: "bg-amber-50 text-amber-600 border-amber-200/60" },
  3: { label: "高", color: "bg-red-50 text-red-600 border-red-200/60" },
} as const;

type SyncStatus = "online" | "offline" | "syncing";
type ViewMode = "list" | "timeline";

// --- 辅助函数 ---

function parseDateLocal(dateString?: string | null) {
  if (!dateString) return null;
  if (typeof dateString === "string" && dateString.length >= 10 && dateString.includes("-")) {
    const [y, m, d] = dateString.slice(0, 10).split("-");
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  return new Date(dateString);
}

function formatDate(dateString?: string | null) {
  const d = parseDateLocal(dateString);
  if (!d || isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getRelativeDayName(dateStr: string) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (dateStr === todayStr) return "今天";
  if (dateStr === yesterdayStr) return "昨天";
  const [, month, day] = dateStr.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function toStartOfDayISO(dateInput: string) {
  if (!dateInput) return "";
  return `${dateInput}T00:00:00Z`;
}

function toEndOfDayISO(dateInput: string) {
  if (!dateInput) return "";
  return `${dateInput}T23:59:59Z`;
}

function nowISO() { return new Date().toISOString(); }

async function parseJSON<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

function getPriorityBarColors(priority: number) {
  switch (priority) {
    case 3: return "bg-red-500 border-red-600 text-white shadow-sm";
    case 2: return "bg-amber-400 border-amber-500 text-white shadow-sm";
    case 1: return "bg-sky-400 border-sky-500 text-white shadow-sm";
    default: return "bg-zinc-300 border-zinc-400 text-zinc-800";
  }
}

// --- 核心组件 ---

export function TodoWorkspace({ storageNamespace }: { storageNamespace: string }) {
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemNote, setNewItemNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [newItemPriority, setNewItemPriority] = useState(0);
  const [newItemStartAt, setNewItemStartAt] = useState("");
  const [newItemDueAt, setNewItemDueAt] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [allItems, setAllItems] = useState<TodoItem[]>([]);
  const [summary, setSummary] = useState<TodoSummary | null>(null);
  const [heatmap, setHeatmap] = useState<TodoHeatmap | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<TodoItem | null>(null);
  const [confirmDeleting, setConfirmDeleting] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");
  const [heatmapRefDate, setHeatmapRefDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const snapshotRef = useRef<TodoOfflineSnapshot>({ items: [], queue: [], updatedAt: nowISO() });
  const syncRunningRef = useRef(false);

  const monthParam = useMemo(() => {
    const year = heatmapRefDate.getFullYear();
    const month = String(heatmapRefDate.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, [heatmapRefDate]);

  const commitSnapshot = useCallback((next: TodoOfflineSnapshot) => {
    snapshotRef.current = next;
    saveTodoOfflineSnapshot(storageNamespace, next);
    setAllItems(next.items);
    setPendingCount(next.queue.length);
  }, [storageNamespace]);

  const fallbackSummary = useMemo(() => buildLocalTodoSummary(allItems), [allItems]);
  const fallbackHeatmap = useMemo(() => buildLocalTodoHeatmap(allItems, heatmapRefDate), [allItems, heatmapRefDate]);

  const openItems = useMemo(() => sortOpenTodoItems(allItems), [allItems]);
  const doneItems = useMemo(() => {
    return [...allItems].filter(i => i.status === "done").sort((a, b) => 
      (parseDateLocal(b.completedAt)?.getTime() ?? 0) - (parseDateLocal(a.completedAt)?.getTime() ?? 0)
    );
  }, [allItems]);

  const summaryView = syncStatus === "online" && summary ? summary : fallbackSummary;
  const heatmapView = syncStatus === "online" && heatmap && heatmap.month === monthParam ? heatmap : fallbackHeatmap;

  // --- 同步逻辑 ---

  const syncFromServer = useCallback(async () => {
    if (syncRunningRef.current) return;
    syncRunningRef.current = true;
    setSyncStatus("syncing");
    try {
      const [openRes, doneRes, sumRes, heatRes] = await Promise.all([
        fetch("/api/todos/items?status=open&limit=300"),
        fetch("/api/todos/items?status=done&days=180&limit=300"),
        fetch("/api/todos/summary"),
        fetch(`/api/todos/heatmap?month=${encodeURIComponent(monthParam)}`),
      ]);
      const open = await parseJSON<{ items: TodoItem[] }>(openRes);
      const done = await parseJSON<{ items: TodoItem[] }>(doneRes);
      const sum = await parseJSON<TodoSummary>(sumRes);
      const heat = await parseJSON<TodoHeatmap>(heatRes);

      const merged = mergeTodoItems(open?.items ?? [], done?.items ?? []);
      commitSnapshot({ items: merged, queue: [], updatedAt: nowISO() });
      if (sum) setSummary(sum);
      if (heat) setHeatmap(heat);
      setSyncStatus("online");
    } catch { setSyncStatus("offline"); }
    finally { syncRunningRef.current = false; }
  }, [commitSnapshot, monthParam]);

  useEffect(() => {
    const snapshot = loadTodoOfflineSnapshot(storageNamespace);
    commitSnapshot(snapshot);
    void syncFromServer();
  }, [storageNamespace, commitSnapshot, syncFromServer]);

  // --- 处理器 ---

  const handleUpdateItem = async (itemID: string, updates: any) => {
    try {
      const res = await fetch(`/api/todos/items/${itemID}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
      if (res.ok) await syncFromServer();
    } catch { toast.error("本地已更新"); }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;
    const payload = { title: newItemTitle.trim(), note: newItemNote.trim(), priority: newItemPriority, startAt: newItemStartAt ? toStartOfDayISO(newItemStartAt) : "", dueAt: newItemDueAt ? toEndOfDayISO(newItemDueAt) : "" };
    setSubmitting(true);
    try {
      const res = await fetch("/api/todos/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) { await syncFromServer(); toast.success("任务已发布"); }
    } catch { toast.error("离线任务已保存"); }
    finally {
      setNewItemTitle(""); setNewItemNote(""); setShowNoteInput(false); setNewItemPriority(0); setNewItemStartAt(""); setNewItemDueAt(""); setSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: TodoItem) => {
    const action = item.status === "open" ? "complete" : "reopen";
    try {
      const res = await fetch(`/api/todos/items/${item.id}/${action}`, { method: "POST" });
      if (res.ok) await syncFromServer();
    } catch { toast.error("状态已切换"); }
  };

  const handleDeleteItem = async () => {
    if (!deleteCandidate) return;
    setConfirmDeleting(true);
    try {
      const res = await fetch(`/api/todos/items/${deleteCandidate.id}`, { method: "DELETE" });
      if (res.ok) { await syncFromServer(); toast.success("任务已删除"); }
    } catch { toast.error("本地已删除"); }
    finally { setDeleteCandidate(null); setConfirmDeleting(false); }
  };

  const handlePrevPeriod = () => setHeatmapRefDate(p => { const d = new Date(p); d.setMonth(d.getMonth() - 1); return d; });
  const handleNextPeriod = () => setHeatmapRefDate(p => { const d = new Date(p); d.setMonth(d.getMonth() + 1); return d > new Date() ? p : d; });

  // --- 数据聚合 ---

  const groupedActiveItems = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const groups: Record<string, { id: string; label: string; order: number; colorClass: string; items: TodoItem[] }> = {};
    const add = (id: string, label: string, order: number, color: string, item: TodoItem) => {
      if (!groups[id]) groups[id] = { id, label, order, colorClass: color, items: [] };
      groups[id].items.push(item);
    };
    openItems.forEach(item => {
      const d = parseDateLocal(item.dueAt || item.startAt);
      if (!d || isNaN(d.getTime())) return add("unscheduled", "待排期", 999, "text-zinc-500 bg-zinc-100/50 border-zinc-200", item);
      d.setHours(0, 0, 0, 0);
      const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < 0) add("overdue", "已延期", -1, "text-rose-600 bg-rose-50 border-rose-200", item);
      else if (diff === 0) add("today", "今天", 0, "text-rose-600 bg-rose-50 border-rose-200", item);
      else if (diff === 1) add("tomorrow", "明天", 1, "text-amber-600 bg-amber-50 border-amber-200", item);
      else add(`future_${diff}`, `${diff}天内`, diff, "text-zinc-600 bg-zinc-100/50 border-zinc-200", item);
    });
    return Object.values(groups).sort((a, b) => a.order - b.order);
  }, [openItems]);

  const { scheduledItems } = useMemo(() => {
    const s: TodoItem[] = [];
    openItems.forEach(i => (i.startAt || i.dueAt) && s.push(i));
    return { scheduledItems: s };
  }, [openItems]);

  const timelineGrid = useMemo(() => {
    if (scheduledItems.length === 0) return [];
    let min = new Date().getTime(), max = new Date().getTime();
    scheduledItems.forEach(i => {
      const s = parseDateLocal(i.startAt), d = parseDateLocal(i.dueAt);
      if (s && !isNaN(s.getTime())) { min = Math.min(min, s.getTime()); max = Math.max(max, s.getTime()); }
      if (d && !isNaN(d.getTime())) { min = Math.min(min, d.getTime()); max = Math.max(max, d.getTime()); }
    });
    const minD = new Date(min); minD.setDate(minD.getDate() - 3);
    const maxD = new Date(max); maxD.setDate(maxD.getDate() + 10);
    const res = [];
    for (const d = new Date(minD); d <= maxD; d.setDate(d.getDate() + 1)) res.push(new Date(d));
    return res;
  }, [scheduledItems]);

  const normalizeToStartOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const now = new Date();
  const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayDone = doneItems.filter(i => formatDate(i.completedAt) === todayString);
  const calendarData = heatmapView.days.map(d => ({ ...d, dayNum: Number(d.date.slice(-2)) }));
  const heatmapDateRange = `${heatmapRefDate.getFullYear()}年 ${heatmapRefDate.getMonth() + 1}月`;
  const isLatestPeriod = heatmapRefDate.getMonth() === new Date().getMonth() && heatmapRefDate.getFullYear() === new Date().getFullYear();

  const syncStatusText = syncStatus === "online" ? "云端已连接" : syncStatus === "syncing" ? "正在同步数据" : `离线模式 (${pendingCount}项未同步)`;
  const syncStatusDot = syncStatus === "online" ? "bg-emerald-500" : syncStatus === "syncing" ? "bg-amber-500 animate-pulse" : "bg-zinc-300";
  const hasDraftOptions = Boolean(newItemStartAt || newItemDueAt || newItemNote || newItemPriority !== 0 || showNoteInput);

  // --- 组件 ---

  const TaskCard = ({ item }: { item: TodoItem }) => {
    const isDone = item.status === "done";
    return (
      <div className={`group flex items-center gap-4 px-4 py-3 rounded-2xl border border-transparent transition-all ${isDone ? "opacity-50" : "hover:border-zinc-100 hover:bg-white dark:hover:bg-zinc-900/40"}`}>
        <button onClick={() => void handleToggleStatus(item)} className={`shrink-0 transition-transform active:scale-90 ${isDone ? "text-rose-500" : "text-zinc-300 hover:text-rose-400"}`}>
          {isDone ? <CheckCircle2 size={20} fill="currentColor" className="text-rose-500 fill-rose-500" /> : <Circle size={20} className="stroke-[2]" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className={`truncate text-sm font-bold ${isDone ? "line-through text-zinc-400" : "text-zinc-900 dark:text-zinc-100"}`}>{item.title}</span>
            <button onClick={() => void handleUpdateItem(item.id, { priority: (item.priority + 1) % 4 })} className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${PRIORITY_MAP[item.priority as 0|1|2|3].color}`}>{PRIORITY_MAP[item.priority as 0|1|2|3].label}</button>
          </div>
          {item.note && <p className="mt-0.5 truncate text-[11px] text-zinc-400">{item.note}</p>}
        </div>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
           <button title="删除" onClick={() => setDeleteCandidate(item)} className="p-1.5 text-zinc-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] flex flex-col h-full animate-in fade-in duration-700 px-4 sm:px-8">
      
      {/* 状态栏 */}
      <header className="flex flex-col sm:flex-row sm:h-16 shrink-0 items-start sm:items-center justify-between border-b border-zinc-100 dark:border-zinc-800/50 py-2.5 sm:py-0 gap-2 sm:gap-0">
        <div className="flex items-center gap-3 w-full sm:w-auto">
           <ListTodo size={20} className="text-rose-500 shrink-0" />
           <nav className="flex flex-1 gap-1 overflow-x-auto no-scrollbar">
              <button onClick={() => setViewMode("list")} className={`whitespace-nowrap px-4 py-2 text-[13px] font-bold rounded-xl transition-all ${viewMode === "list" ? "text-rose-600 bg-rose-50 dark:bg-rose-500/10" : "text-zinc-400 hover:text-zinc-900"}`}>任务列表</button>
              <button onClick={() => setViewMode("timeline")} className={`whitespace-nowrap px-4 py-2 text-[13px] font-bold rounded-xl transition-all ${viewMode === "timeline" ? "text-rose-600 bg-rose-50 dark:bg-rose-500/10" : "text-zinc-400 hover:text-zinc-900"}`}>甘特排期</button>
           </nav>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 border-zinc-50 pt-2 sm:pt-0">
          <div className="flex items-center gap-2 px-2 py-1 transition-all">
             <div className={`h-1.5 w-1.5 rounded-full ${syncStatusDot}`} />
             <span className="text-[11px] font-bold text-zinc-400 tracking-wide uppercase">{syncStatusText}</span>
          </div>
          <button 
            title="手动刷新" 
            onClick={() => void syncFromServer()} 
            className="p-2 rounded-full text-zinc-300 hover:text-zinc-900 hover:bg-zinc-50 transition-all dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            {syncStatus === "syncing" ? <Loader2 size={16} className="animate-spin text-rose-500" /> : <RefreshCw size={16} />}
          </button>
        </div>
      </header>

      <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto py-4 sm:py-8">
        <div className="grid grid-cols-1 gap-8 lg:gap-12 lg:grid-cols-12">
          
          {/* 任务内容区 (Mobile First: Order 1 on Desktop, but naturally first on mobile) */}
          <div className="space-y-8 lg:col-span-8">
            <section className="relative w-full">
              <form 
                onSubmit={handleCreateItem} 
                className="group relative flex flex-col bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 focus-within:bg-white dark:focus-within:bg-zinc-950 focus-within:shadow-xl focus-within:border-zinc-300 dark:focus-within:border-zinc-700 transition-all duration-300 ease-out"
              >
                {/* 核心输入区 - 极致清爽 */}
                <div className="flex items-center min-h-[60px] px-5 gap-4">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                    <div className="h-5 w-5 rounded-full border-2 border-zinc-300 dark:border-zinc-700 group-focus-within:border-zinc-900 dark:group-focus-within:border-zinc-100 transition-colors" />
                  </div>
                  <input
                    className="flex-1 bg-transparent text-[17px] font-semibold outline-none placeholder-zinc-400 dark:placeholder-zinc-600 text-zinc-900 dark:text-zinc-100"
                    placeholder="新建任务目标..."
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNoteInput(!showNoteInput)}
                    className={`p-2 rounded-lg transition-all ${showNoteInput || newItemNote ? "text-zinc-900 bg-zinc-100 dark:text-zinc-100 dark:bg-zinc-800" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                  >
                    <AlignLeft size={20} strokeWidth={2} />
                  </button>
                </div>

                {/* 配置区 */}
                <div className={`overflow-hidden transition-all duration-300 ${(newItemTitle || showNoteInput || newItemNote) ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className="px-5 pb-5 space-y-4">
                    {/* 备注区 */}
                    {(showNoteInput || newItemNote) && (
                      <div className="ml-10">
                        <textarea
                          className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 rounded-xl p-3 text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400 outline-none resize-none placeholder-zinc-400 border border-transparent focus:border-zinc-200 dark:focus:border-zinc-800 min-h-[80px] transition-all"
                          placeholder="补充详细说明..."
                          value={newItemNote}
                          onChange={(e) => setNewItemNote(e.target.value)}
                        />
                      </div>
                    )}

                    {/* 工具栏 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 ml-0 sm:ml-10">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* 时间 Chip */}
                        <div className="flex items-center h-8 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 gap-2 shadow-sm text-zinc-500 dark:text-zinc-400">
                          <Calendar size={14} strokeWidth={2} />
                          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-tight">
                            <input type="date" className="bg-transparent outline-none w-[85px]" value={newItemStartAt} onChange={(e) => setNewItemStartAt(e.target.value)} />
                            <span className="opacity-20">/</span>
                            <input type="date" className="bg-transparent outline-none w-[85px]" value={newItemDueAt} onChange={(e) => setNewItemDueAt(e.target.value)} />
                          </div>
                        </div>

                        {/* 优先级 Chip */}
                        <button
                          type="button"
                          onClick={() => setNewItemPriority((p) => (p + 1) % 4)}
                          className={`h-8 px-3 rounded-lg flex items-center gap-2 border text-[11px] font-bold transition-all shadow-sm active:scale-95 ${
                            newItemPriority === 0 ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400" :
                            newItemPriority === 1 ? "bg-sky-50 text-sky-600 border-sky-100" :
                            newItemPriority === 2 ? "bg-amber-50 text-amber-600 border-amber-100" :
                            "bg-red-50 text-red-600 border-red-100"
                          }`}
                        >
                          <Flag size={12} strokeWidth={3} />
                          {PRIORITY_MAP[newItemPriority as 0|1|2|3].label}级
                        </button>

                        {/* 重置 */}
                        {(newItemStartAt || newItemDueAt || newItemNote || newItemPriority !== 0) && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewItemNote(""); setShowNoteInput(false); setNewItemPriority(0);
                              setNewItemStartAt(""); setNewItemDueAt("");
                            }}
                            className="h-8 w-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all"
                          >
                            <RefreshCw size={14} />
                          </button>
                        )}
                      </div>

                      {/* 发布按钮 - 经典 Google 风格 */}
                      <button
                        type="submit"
                        disabled={isSubmitting || !newItemTitle.trim()}
                        className="h-9 px-6 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[13px] font-bold shadow-md hover:bg-zinc-800 dark:hover:bg-white active:scale-95 disabled:opacity-20 transition-all ml-auto flex items-center gap-2"
                      >
                        {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : (
                          <>
                            <span>发布任务</span>
                            <ChevronRight size={14} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </section>

            {viewMode === "list" ? (
              <section className="space-y-8">
                {groupedActiveItems.map(group => (
                  <div key={group.id} className="space-y-4">
                    <div className="flex items-center gap-3">
                       <span className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${group.colorClass}`}>{group.label}</span>
                       <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50 bg-zinc-50/30 rounded-3xl p-1 sm:p-2 border border-zinc-100 dark:border-zinc-800">
                       {group.items.map(item => <TaskCard key={item.id} item={item} />)}
                    </div>
                  </div>
                ))}
              </section>
            ) : (
              <div className="rounded-3xl border border-zinc-100 bg-zinc-50/30 p-1 dark:bg-zinc-900/30 overflow-hidden shadow-inner">
                 <div className="bg-white dark:bg-zinc-950 rounded-[1.4rem] overflow-x-auto custom-scrollbar border border-zinc-100 dark:border-zinc-800">
                    <div className="flex min-w-max flex-col">
                       {/* 甘特图实现保持不变，但容器现在支持横向滚动 */}
                       <div className="flex border-b border-zinc-100 bg-zinc-50/50">
                          <div className="sticky left-0 z-10 w-40 sm:w-48 px-4 sm:px-6 py-3 text-[10px] font-black uppercase text-zinc-400 bg-zinc-50 border-r border-zinc-100">甘特图时间轴</div>
                          {timelineGrid.map((d: any) => {
                            const isT = normalizeToStartOfDay(d) === normalizeToStartOfDay(new Date());
                            return <div key={d.toISOString()} className={`w-12 py-2 text-center border-r border-zinc-100 ${isT ? "bg-rose-50/50" : ""}`}>
                               <p className="text-[8px] font-black text-zinc-400 uppercase">{["日","一","二","三","四","五","六"][d.getDay()]}</p>
                               <p className={`text-[11px] font-black ${isT ? "text-rose-600" : "text-zinc-600"}`}>{d.getDate()}</p>
                            </div>;
                          })}
                       </div>
                       {scheduledItems.map(item => {
                          const s = parseDateLocal(item.startAt) ?? parseDateLocal(item.dueAt) ?? new Date();
                          const e = parseDateLocal(item.dueAt) ?? parseDateLocal(item.startAt) ?? new Date();
                          const base = normalizeToStartOfDay(timelineGrid[0] as any);
                          const start = Math.floor((normalizeToStartOfDay(s) - base) / 86400000);
                          const dur = Math.floor((normalizeToStartOfDay(e) - normalizeToStartOfDay(s)) / 86400000) + 1;
                          return (
                            <div key={item.id} className="flex border-b border-zinc-100 h-12 relative items-center hover:bg-zinc-50/50 transition-colors">
                               <div className="sticky left-0 z-10 w-40 sm:w-48 px-4 sm:px-6 flex items-center gap-2 bg-white dark:bg-zinc-950 border-r border-zinc-100">
                                  <Circle size={10} className="text-zinc-300" />
                                  <span className="text-xs font-bold truncate text-zinc-600 dark:text-zinc-400">{item.title}</span>
                               </div>
                               <div className="flex flex-1 relative h-full">
                                  {timelineGrid.map((d: any) => <div key={d.toISOString()} className="w-12 h-full border-r border-zinc-50" />)}
                                  <div className={`absolute top-2 bottom-2 rounded-lg border px-2 flex items-center text-[9px] font-black uppercase text-white shadow-md transition-all ${getPriorityBarColors(item.priority)}`} style={{ left: `${start * 48 + 4}px`, width: `${dur * 48 - 8}px` }}>
                                     <span className="truncate">{item.title}</span>
                                  </div>
                               </div>
                            </div>
                          );
                       })}
                    </div>
                 </div>
              </div>
            )}

            {todayDone.length > 0 && (
              <section className="mt-8 sm:mt-12 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-lg bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest border border-rose-100">今日已完成目标</span>
                  <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50 bg-zinc-50/30 rounded-3xl p-1 sm:p-2 border border-zinc-100 dark:border-zinc-800">
                   {todayDone.map(i => <TaskCard key={i.id} item={i} />)}
                </div>
              </section>
            )}
          </div>

          {/* 统计与日历区 (Mobile Bottom, Desktop Right) */}
          <div className="lg:col-span-4 space-y-8 lg:space-y-10 lg:border-l lg:border-zinc-100 lg:pl-10 dark:border-zinc-800/50">
            <div className="space-y-6">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">效率实时分析</h3>
               <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                  <div className="flex items-center justify-between p-4 sm:p-6 rounded-3xl bg-white border border-zinc-100 dark:bg-zinc-900/30 transition-all hover:border-rose-200 shadow-sm">
                     <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
                        <div className="p-2 sm:p-3 bg-rose-50 text-rose-600 rounded-2xl"><Trophy size={18} /></div>
                        <span className="text-[10px] sm:text-sm font-bold text-zinc-600 dark:text-zinc-400">今日完成</span>
                     </div>
                     <span className="text-xl sm:text-3xl font-black text-rose-600">{summaryView.completedToday}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 sm:p-6 rounded-3xl bg-white border border-zinc-100 dark:bg-zinc-900/30 transition-all hover:border-orange-200 shadow-sm">
                     <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
                        <div className="p-2 sm:p-3 bg-orange-50 text-orange-500 rounded-2xl"><Flame size={18} /></div>
                        <span className="text-[10px] sm:text-sm font-bold text-zinc-600 dark:text-zinc-400">连续专注</span>
                     </div>
                     <span className="text-xl sm:text-3xl font-black text-orange-600">{summaryView.currentStreak}</span>
                  </div>
               </div>
            </div>

            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">打卡热力日历</h3>
                  <div className="flex gap-1 bg-zinc-100 p-0.5 rounded-lg dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                     <button onClick={handlePrevPeriod} className="p-1 hover:bg-white rounded transition-all shadow-sm"><ChevronLeft size={14} /></button>
                     <button onClick={handleNextPeriod} disabled={isLatestPeriod} className="p-1 hover:bg-white rounded disabled:opacity-20 transition-all shadow-sm"><ChevronRight size={14} /></button>
                  </div>
               </div>
               <div className="p-4 sm:p-6 rounded-3xl bg-white border border-zinc-100 dark:bg-zinc-900/30 shadow-sm">
                  <div className="mb-6 text-xs sm:text-sm font-black text-zinc-900 dark:text-zinc-100 flex items-center justify-between">
                     {heatmapDateRange}
                     <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[9px] font-semibold text-zinc-500">
                       月度热力
                     </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                    {["日","一","二","三","四","五","六"].map(d => <div key={d} className="text-center text-[8px] font-black text-zinc-300 uppercase pb-2">{d}</div>)}
                    {calendarData.map(d => {
                      const isT = d.date === todayString;
                      let cls = "bg-transparent opacity-20";
                      if (d.isCurrentMonth) {
                        if (d.count === 0) cls = "bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border border-transparent";
                        else if (d.count <= 1) cls = "bg-rose-100 text-rose-600 border border-rose-200/50";
                        else if (d.count <= 3) cls = "bg-rose-200 text-rose-700 border border-rose-300/50";
                        else if (d.count <= 5) cls = "bg-rose-400 text-white shadow-sm";
                        else cls = "bg-rose-600 text-white font-black shadow-md";
                      }
                      return <div key={d.date} className={`aspect-square rounded-lg text-[9px] sm:text-[10px] font-bold flex items-center justify-center transition-all ${cls} ${isT ? "ring-2 ring-rose-500 ring-offset-2 scale-110 z-10" : ""}`}>{d.isCurrentMonth ? d.dayNum : ""}</div>;
                    })}
                  </div>
                  <div className="mt-6 sm:mt-8 flex items-center justify-end gap-2 text-[8px] font-black uppercase text-zinc-400">
                     <span>少</span>
                     <div className="flex gap-1">
                        {[0, 1, 3, 5, 10].map(v => (
                          <div key={v} className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-sm ${v === 0 ? "bg-zinc-100 dark:bg-zinc-800" : v <= 1 ? "bg-rose-100" : v <= 3 ? "bg-rose-200" : v <= 5 ? "bg-rose-400" : "bg-rose-600"}`} />
                        ))}
                     </div>
                     <span>多</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleteCandidate)} title="确认删除任务？" description={deleteCandidate ? `确认永久删除任务「${deleteCandidate.title}」？此操作不可撤销。` : ""}
        confirmText="确认删除" danger loading={confirmDeleting} onCancel={() => setDeleteCandidate(null)} onConfirm={handleDeleteItem}
      />
    </div>
  );
}
