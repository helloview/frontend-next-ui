"use client";

import {
  AlignLeft,
  Calendar,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CornerDownLeft,
  Edit2,
  Flag,
  Flame,
  GanttChart,
  LayoutList,
  ListTodo,
  Target,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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

type TodoServiceSnapshot = {
  items: TodoItem[];
  summary: TodoSummary;
  heatmap: TodoHeatmap;
};

function parseDateLocal(dateString?: string | null) {
  if (!dateString) return null;
  if (typeof dateString === "string" && dateString.length >= 10 && dateString.includes("-")) {
    const [y, m, d] = dateString.slice(0, 10).split("-");
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(dateString);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(dateString?: string | null) {
  const d = parseDateLocal(dateString);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatShortDate(dateString?: string | null) {
  const d = parseDateLocal(dateString);
  if (!d) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateTime(dateString?: string | null) {
  const d = parseDateLocal(dateString);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours(),
  ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getRelativeDayName(dateStr: string) {
  const today = new Date();
  const todayStr = formatDate(today.toISOString());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDate(yesterday.toISOString());

  if (dateStr === todayStr) return "今天";
  if (dateStr === yesterdayStr) return "昨天";

  const [, month, day] = dateStr.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function toStartOfDayISO(dateInput: string) {
  if (!dateInput) return "";
  const [year, month, day] = dateInput.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function toEndOfDayISO(dateInput: string) {
  if (!dateInput) return "";
  const [year, month, day] = dateInput.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

function nowISO() {
  return new Date().toISOString();
}

function buildErrorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  if ("error" in body && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return fallback;
}

async function parseJSON<T>(response: Response): Promise<T | null> {
  return (await response.json().catch(() => null)) as T | null;
}

function getPriorityBarColors(priority: number) {
  switch (priority) {
    case 3:
      return "bg-red-500 border-red-600 text-red-50";
    case 2:
      return "bg-amber-400 border-amber-500 text-amber-50";
    case 1:
      return "bg-sky-400 border-sky-500 text-sky-50";
    default:
      return "bg-zinc-300 border-zinc-400 text-zinc-800";
  }
}

function getHeatmapColor(count: number) {
  if (count === 0) return "bg-zinc-100/60";
  if (count <= 1) return "bg-rose-200";
  if (count <= 3) return "bg-rose-300";
  if (count <= 5) return "bg-rose-400";
  return "bg-rose-500";
}

export function TodoWorkspace({ storageNamespace }: { storageNamespace: string }) {
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemNote, setNewItemNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [newItemPriority, setNewItemPriority] = useState(0);
  const [newItemStartAt, setNewItemStartAt] = useState("");
  const [newItemDueAt, setNewItemDueAt] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [allItems, setAllItems] = useState<TodoItem[]>([]);
  const [summary, setSummary] = useState<TodoSummary | null>(null);
  const [heatmap, setHeatmap] = useState<TodoHeatmap | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("syncing");
  const [heatmapRefDate, setHeatmapRefDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const snapshotRef = useRef<TodoOfflineSnapshot>({ items: [], queue: [], updatedAt: nowISO() });
  const syncRunningRef = useRef(false);
  const offlineToastShownRef = useRef(false);

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
    return [...allItems]
      .filter((item) => item.status === "done")
      .sort((a, b) => {
        const aTime = parseDateLocal(a.completedAt)?.getTime() ?? 0;
        const bTime = parseDateLocal(b.completedAt)?.getTime() ?? 0;
        return bTime - aTime;
      });
  }, [allItems]);

  const summaryView = syncStatus === "online" && summary ? summary : fallbackSummary;
  const heatmapView =
    syncStatus === "online" && heatmap && heatmap.month === monthParam && heatmap.days.length > 0 ? heatmap : fallbackHeatmap;

  const fetchServerSnapshot = useCallback(
    async (month: string): Promise<TodoServiceSnapshot> => {
      const [openRes, doneRes, summaryRes, heatmapRes] = await Promise.all([
        fetch("/api/todos/items?status=open&limit=300", { cache: "no-store" }),
        fetch("/api/todos/items?status=done&days=180&limit=300", { cache: "no-store" }),
        fetch("/api/todos/summary", { cache: "no-store" }),
        fetch(`/api/todos/heatmap?month=${encodeURIComponent(month)}`, { cache: "no-store" }),
      ]);

      const openBody = (await parseJSON<{ error?: string; items?: TodoItem[] }>(openRes)) ?? null;
      const doneBody = (await parseJSON<{ error?: string; items?: TodoItem[] }>(doneRes)) ?? null;
      const summaryBody = (await parseJSON<{ error?: string } & Partial<TodoSummary>>(summaryRes)) ?? null;
      const heatmapBody = (await parseJSON<{ error?: string } & Partial<TodoHeatmap>>(heatmapRes)) ?? null;

      if (!openRes.ok) throw new Error(buildErrorMessage(openBody, "加载进行中任务失败"));
      if (!doneRes.ok) throw new Error(buildErrorMessage(doneBody, "加载已完成任务失败"));
      if (!summaryRes.ok) throw new Error(buildErrorMessage(summaryBody, "加载统计失败"));
      if (!heatmapRes.ok) throw new Error(buildErrorMessage(heatmapBody, "加载热力图失败"));

      return {
        items: mergeTodoItems(openBody?.items ?? [], doneBody?.items ?? []),
        summary: {
          active: summaryBody?.active ?? 0,
          completedToday: summaryBody?.completedToday ?? 0,
          currentStreak: summaryBody?.currentStreak ?? 0,
          timezone: summaryBody?.timezone ?? "",
        },
        heatmap: {
          month: heatmapBody?.month ?? month,
          tz: heatmapBody?.tz ?? "",
          range: heatmapBody?.range ?? { from: "", to: "" },
          days: heatmapBody?.days ?? [],
        },
      };
    },
    [],
  );

  const flushQueue = useCallback(async (snapshot: TodoOfflineSnapshot): Promise<TodoOfflineSnapshot> => {
    const idMap = new Map<string, string>();
    const remaining: TodoOfflineOperation[] = [];
    let items = [...snapshot.items];

    for (let index = 0; index < snapshot.queue.length; index += 1) {
      const op = snapshot.queue[index];
      try {
        if (op.type === "create") {
          const response = await fetch("/api/todos/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(op.payload),
          });
          const body = await parseJSON<{ error?: string } & Partial<TodoItem>>(response);
          if (!response.ok || !body?.id) throw new Error(buildErrorMessage(body, "创建任务失败"));
          const serverItem = body as TodoItem;
          idMap.set(op.clientId, serverItem.id);
          items = items.map((item) => (item.id === op.clientId ? serverItem : item));
          continue;
        }

        const sourceID = op.itemId;
        const targetID = idMap.get(sourceID) ?? sourceID;

        if (op.type === "update") {
          if (targetID.startsWith("local-")) {
            remaining.push(op);
            continue;
          }
          const response = await fetch(`/api/todos/items/${targetID}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(op.payload),
          });
          const body = await parseJSON<{ error?: string } & Partial<TodoItem>>(response);
          if (!response.ok || !body?.id) throw new Error(buildErrorMessage(body, "更新任务失败"));
          items = replaceTodoItem(items, body as TodoItem);
          continue;
        }

        if (op.type === "complete" || op.type === "reopen") {
          if (targetID.startsWith("local-")) {
            remaining.push(op);
            continue;
          }
          const response = await fetch(`/api/todos/items/${targetID}/${op.type}`, { method: "POST" });
          const body = await parseJSON<{ error?: string } & Partial<TodoItem>>(response);
          if (!response.ok || !body?.id) throw new Error(buildErrorMessage(body, "更新任务状态失败"));
          items = replaceTodoItem(items, body as TodoItem);
          continue;
        }

        if (targetID.startsWith("local-")) {
          items = items.filter((item) => item.id !== targetID);
          continue;
        }

        const response = await fetch(`/api/todos/items/${targetID}`, { method: "DELETE" });
        if (!response.ok) {
          const body = await parseJSON<{ error?: string }>(response);
          throw new Error(buildErrorMessage(body, "删除任务失败"));
        }
        items = items.filter((item) => item.id !== targetID);
      } catch {
        remaining.push(op, ...snapshot.queue.slice(index + 1));
        break;
      }
    }

    return {
      items,
      queue: remaining,
      updatedAt: nowISO(),
    };
  }, []);

  const syncFromServer = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (syncRunningRef.current) return;
      syncRunningRef.current = true;
      setSyncStatus("syncing");

      try {
        let snapshot = snapshotRef.current;

        if (snapshot.queue.length > 0) {
          snapshot = await flushQueue(snapshot);
          commitSnapshot(snapshot);
        }

        const server = await fetchServerSnapshot(monthParam);
        const mergedItems = snapshot.queue.length > 0 ? mergeTodoItems(server.items, snapshot.items) : server.items;

        snapshot = {
          items: mergedItems,
          queue: snapshot.queue,
          updatedAt: nowISO(),
        };

        commitSnapshot(snapshot);
        setSummary(server.summary);
        setHeatmap(server.heatmap);

        if (snapshot.queue.length === 0) {
          setSyncStatus("online");
          offlineToastShownRef.current = false;
        } else {
          setSyncStatus("offline");
        }
      } catch {
        setSyncStatus("offline");
        if (!silent && !offlineToastShownRef.current) {
          toast.message("Todo 服务离线，已切换本地模式");
          offlineToastShownRef.current = true;
        }
      } finally {
        syncRunningRef.current = false;
      }
    },
    [commitSnapshot, fetchServerSnapshot, flushQueue, monthParam],
  );

  const applyOffline = useCallback(
    (op: TodoOfflineOperation, tip = "已离线保存，服务恢复后自动同步") => {
      const next = queueTodoOfflineOperation(snapshotRef.current, op);
      commitSnapshot(next);
      setSyncStatus("offline");
      toast.message(tip);
    },
    [commitSnapshot],
  );

  useEffect(() => {
    const snapshot = loadTodoOfflineSnapshot(storageNamespace);
    commitSnapshot(snapshot);

    if (snapshot.items.length > 0) {
      setSummary(buildLocalTodoSummary(snapshot.items));
      setHeatmap(buildLocalTodoHeatmap(snapshot.items, heatmapRefDate));
      setSyncStatus(snapshot.queue.length > 0 ? "offline" : "syncing");
    }

    void syncFromServer({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageNamespace]);

  useEffect(() => {
    void syncFromServer({ silent: true });
  }, [monthParam, syncFromServer]);

  useEffect(() => {
    const onOnline = () => {
      void syncFromServer({ silent: true });
    };

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (syncStatus !== "online" || snapshotRef.current.queue.length > 0) {
        void syncFromServer({ silent: true });
      }
    }, 15000);

    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(timer);
    };
  }, [syncFromServer, syncStatus]);

  const handleUpdateItem = useCallback(
    async (itemID: string, updates: { title?: string; note?: string; priority?: number; startAt?: string | null; dueAt?: string | null }) => {
      try {
        const response = await fetch(`/api/todos/items/${itemID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const body = await parseJSON<{ error?: string }>(response);
        if (!response.ok) throw new Error(buildErrorMessage(body, "更新任务失败"));
        await syncFromServer({ silent: true });
      } catch {
        applyOffline(
          {
            type: "update",
            itemId: itemID,
            payload: updates,
            createdAt: nowISO(),
          },
          "已离线保存更改，恢复后自动同步",
        );
      }
    },
    [applyOffline, syncFromServer],
  );

  const handleCreateItem = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = newItemTitle.trim();
    if (!title) return;

    const payload = {
      title,
      note: newItemNote.trim(),
      priority: newItemPriority,
      startAt: newItemStartAt ? toStartOfDayISO(newItemStartAt) : "",
      dueAt: newItemDueAt ? toEndOfDayISO(newItemDueAt) : "",
    };

    setSubmitting(true);
    try {
      const response = await fetch("/api/todos/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await parseJSON<{ error?: string }>(response);
      if (!response.ok) throw new Error(buildErrorMessage(body, "创建任务失败"));

      await syncFromServer({ silent: true });
      toast.success("任务已创建");
    } catch {
      applyOffline({
        type: "create",
        clientId: generateLocalTodoID(),
        payload,
        createdAt: nowISO(),
      });
    } finally {
      setNewItemTitle("");
      setNewItemNote("");
      setShowNoteInput(false);
      setNewItemPriority(0);
      setNewItemStartAt("");
      setNewItemDueAt("");
      setSubmitting(false);
    }
  };

  const handleToggleItemStatus = async (itemID: string, currentStatus: TodoItem["status"]) => {
    const action = currentStatus === "open" ? "complete" : "reopen";

    try {
      const response = await fetch(`/api/todos/items/${itemID}/${action}`, { method: "POST" });
      const body = await parseJSON<{ error?: string }>(response);
      if (!response.ok) throw new Error(buildErrorMessage(body, "更新任务状态失败"));
      await syncFromServer({ silent: true });
    } catch {
      applyOffline({ type: action, itemId: itemID, createdAt: nowISO() });
    }
  };

  const handleDeleteItem = async (itemID: string) => {
    try {
      const response = await fetch(`/api/todos/items/${itemID}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await parseJSON<{ error?: string }>(response);
        throw new Error(buildErrorMessage(body, "删除任务失败"));
      }
      await syncFromServer({ silent: true });
      toast.success("任务已删除");
    } catch {
      applyOffline({ type: "delete", itemId: itemID, createdAt: nowISO() });
    }
  };

  const handleChangePriority = async (itemID: string, currentPriority: number) => {
    const nextPriority = (currentPriority + 1) % 4;
    await handleUpdateItem(itemID, { priority: nextPriority });
  };

  const groupedActiveItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const groups: Record<string, { id: string; label: string; order: number; colorClass: string; items: TodoItem[] }> = {};
    const createGroup = (id: string, label: string, order: number, colorClass: string) => {
      if (!groups[id]) groups[id] = { id, label, order, colorClass, items: [] };
    };

    openItems.forEach((item) => {
      const targetDateRaw = item.dueAt || item.startAt;

      if (!targetDateRaw) {
        createGroup("unscheduled", "无排期待办", 99999, "text-zinc-500 bg-zinc-100 border-zinc-200/60");
        groups.unscheduled.items.push(item);
        return;
      }

      const targetDate = parseDateLocal(targetDateRaw);
      if (!targetDate) {
        createGroup("unscheduled", "无排期待办", 99999, "text-zinc-500 bg-zinc-100 border-zinc-200/60");
        groups.unscheduled.items.push(item);
        return;
      }
      targetDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        createGroup("overdue", "已延期", -1, "text-rose-600 bg-rose-50 border-rose-200/60");
        groups.overdue.items.push(item);
      } else if (diffDays === 0) {
        createGroup("today", "今天", 0, "text-rose-600 bg-rose-50 border-rose-200/60");
        groups.today.items.push(item);
      } else if (diffDays === 1) {
        createGroup("tomorrow", "明天", 1, "text-amber-600 bg-amber-50 border-amber-200/60");
        groups.tomorrow.items.push(item);
      } else {
        const key = `future_${diffDays}`;
        createGroup(key, `${diffDays} 天内完成`, diffDays, "text-zinc-600 bg-zinc-100 border-zinc-200/60");
        groups[key].items.push(item);
      }
    });

    return Object.values(groups).sort((a, b) => a.order - b.order);
  }, [openItems]);

  const { scheduledItems, unscheduledItems } = useMemo(() => {
    const scheduled: TodoItem[] = [];
    const unscheduled: TodoItem[] = [];
    openItems.forEach((item) => {
      if (item.startAt || item.dueAt) {
        scheduled.push(item);
      } else {
        unscheduled.push(item);
      }
    });
    return { scheduledItems: scheduled, unscheduledItems: unscheduled };
  }, [openItems]);

  const timelineGrid = useMemo(() => {
    if (scheduledItems.length === 0) return [] as Date[];

    let minTime = new Date().getTime();
    let maxTime = new Date().getTime();

    scheduledItems.forEach((item) => {
      const start = parseDateLocal(item.startAt);
      const due = parseDateLocal(item.dueAt);
      if (start) minTime = Math.min(minTime, start.getTime());
      if (due) minTime = Math.min(minTime, due.getTime());
      if (start) maxTime = Math.max(maxTime, start.getTime());
      if (due) maxTime = Math.max(maxTime, due.getTime());
    });

    const minDate = new Date(minTime);
    minDate.setDate(minDate.getDate() - 3);
    const maxDate = new Date(maxTime);
    maxDate.setDate(maxDate.getDate() + 10);

    const days: Date[] = [];
    for (const d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return days;
  }, [scheduledItems]);

  const normalizeToStartOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const stats = useMemo(() => ({ active: openItems.length, done: doneItems.length }), [openItems.length, doneItems.length]);

  const groupedDoneItems = useMemo(() => {
    const groups: Record<string, TodoItem[]> = {};

    doneItems.forEach((item) => {
      if (!item.completedAt) return;
      const dateStr = formatDate(item.completedAt);
      if (!dateStr) return;
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(item);
    });

    return Object.keys(groups)
      .sort((a, b) => {
        const aTime = parseDateLocal(a)?.getTime() ?? 0;
        const bTime = parseDateLocal(b)?.getTime() ?? 0;
        return bTime - aTime;
      })
      .map((date) => ({ date, items: groups[date] }));
  }, [doneItems]);

  const todayString = useMemo(() => formatDate(new Date().toISOString()), []);
  const todayGroup = groupedDoneItems.find((group) => group.date === todayString);
  const pastGroups = groupedDoneItems.filter((group) => group.date !== todayString);

  const calendarData = useMemo(() => {
    return heatmapView.days.map((day) => ({
      ...day,
      dayNum: Number(day.date.slice(-2)),
    }));
  }, [heatmapView.days]);

  const handlePrevPeriod = () => {
    setHeatmapRefDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextPeriod = () => {
    setHeatmapRefDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      const now = new Date();
      if (d > now) return new Date(now.getFullYear(), now.getMonth(), 1);
      return d;
    });
  };

  const isLatestPeriod = useMemo(() => {
    const now = new Date();
    return heatmapRefDate.getMonth() === now.getMonth() && heatmapRefDate.getFullYear() === now.getFullYear();
  }, [heatmapRefDate]);

  const heatmapDateRange = useMemo(() => `${heatmapRefDate.getFullYear()}年 ${heatmapRefDate.getMonth() + 1}月`, [heatmapRefDate]);

  const hasPendingSync = pendingCount > 0;

  const syncStatusText =
    syncStatus === "online"
      ? "云端已连接"
      : syncStatus === "syncing"
        ? hasPendingSync
          ? `同步中 · 待同步 ${pendingCount} 项`
          : "同步中..."
        : hasPendingSync
          ? `离线模式 · ${pendingCount} 项待同步`
          : "离线模式 · 本地可用";

  const syncStatusClass =
    syncStatus === "online"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : syncStatus === "syncing"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : hasPendingSync
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";

  const TaskCard = ({ item }: { item: TodoItem }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(item.title);
    const [editNote, setEditNote] = useState(item.note || "");
    const [editStartAt, setEditStartAt] = useState(item.startAt ? formatDate(item.startAt) : "");
    const [editDueAt, setEditDueAt] = useState(item.dueAt ? formatDate(item.dueAt) : "");

    const handleSaveEdit = async () => {
      if (!editTitle.trim()) return;

      const finalStartAt = editStartAt ? toStartOfDayISO(editStartAt) : null;
      const finalDueAt = editDueAt ? toEndOfDayISO(editDueAt) : null;

      await handleUpdateItem(item.id, {
        title: editTitle.trim(),
        note: editNote.trim(),
        startAt: finalStartAt,
        dueAt: finalDueAt,
      });
      setIsEditing(false);
    };

    const handleCancelEdit = () => {
      setEditTitle(item.title);
      setEditNote(item.note || "");
      setEditStartAt(item.startAt ? formatDate(item.startAt) : "");
      setEditDueAt(item.dueAt ? formatDate(item.dueAt) : "");
      setIsEditing(false);
    };

    if (isEditing) {
      return (
        <div className="relative z-10 rounded-xl border border-rose-300 bg-white p-4 shadow-md transition-all dark:border-rose-700 dark:bg-zinc-900">
          <input
            type="text"
            className="mb-3 w-full border-b border-zinc-200 bg-transparent pb-1.5 text-[1.05rem] font-medium text-zinc-800 outline-none transition-colors placeholder-zinc-400 focus:border-rose-400 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            placeholder="任务名称..."
            autoFocus
          />
          <textarea
            className="mb-4 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 text-sm text-zinc-600 outline-none transition-all placeholder-zinc-400 focus:border-rose-400 focus:ring-1 focus:ring-rose-400/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:placeholder-zinc-500"
            value={editNote}
            onChange={(event) => setEditNote(event.target.value)}
            placeholder="添加详细备注 (选填)..."
            rows={2}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 transition-all focus-within:border-rose-400 focus-within:ring-1 focus-within:ring-rose-400/20 dark:border-zinc-700 dark:bg-zinc-800">
                <span className="text-[10px] font-bold uppercase text-zinc-400 dark:text-zinc-500">起</span>
                <input
                  type="date"
                  className="w-[110px] cursor-pointer bg-transparent text-xs text-zinc-700 outline-none dark:text-zinc-300"
                  value={editStartAt}
                  onChange={(event) => setEditStartAt(event.target.value)}
                />
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 transition-all focus-within:border-rose-400 focus-within:ring-1 focus-within:ring-rose-400/20 dark:border-zinc-700 dark:bg-zinc-800">
                <span className="text-[10px] font-bold uppercase text-zinc-400 dark:text-zinc-500">止</span>
                <input
                  type="date"
                  className="w-[110px] cursor-pointer bg-transparent text-xs text-zinc-700 outline-none dark:text-zinc-300"
                  value={editDueAt}
                  onChange={(event) => setEditDueAt(event.target.value)}
                />
              </div>
            </div>
            <div className="flex-1" />
            <div className="mt-2 flex items-center gap-2 sm:mt-0">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveEdit();
                }}
                className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-600"
              >
                保存更改
              </button>
            </div>
          </div>
        </div>
      );
    }

    const isDone = item.status === "done";

    let dueColorClass = "text-zinc-400";
    if (!isDone && item.dueAt) {
      const dueStr = formatDate(item.dueAt);
      if (dueStr < todayString) dueColorClass = "font-bold text-rose-500";
      else if (dueStr === todayString) dueColorClass = "font-bold text-rose-500";
      else dueColorClass = "text-zinc-500";
    }

    return (
      <div
        className={`group relative flex items-start gap-4 rounded-xl p-4 transition-all duration-300 ${
          isDone
            ? "border border-transparent bg-zinc-50/50 opacity-70 dark:bg-zinc-800/40"
            : "border border-zinc-200/80 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
        }`}
      >
        <button
          type="button"
          onClick={() => {
            void handleToggleItemStatus(item.id, item.status);
          }}
          className={`mt-0.5 flex-shrink-0 transition-all duration-300 active:scale-90 hover:scale-110 ${
            isDone ? "text-rose-500" : "text-zinc-300 hover:text-rose-400"
          }`}
        >
          {isDone ? <CheckCircle2 className="h-5 w-5 fill-rose-500 text-white" /> : <Circle className="h-5 w-5 stroke-[2]" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span
              className={`truncate text-[1.05rem] font-medium transition-all duration-300 ${
                isDone ? "text-zinc-400 line-through decoration-zinc-300 dark:text-zinc-500" : "text-zinc-800 dark:text-zinc-100"
              }`}
            >
              {item.title}
            </span>
            <button
              type="button"
              onClick={() => {
                void handleChangePriority(item.id, item.priority);
              }}
              className={`cursor-pointer rounded-md border px-2 py-0.5 text-[10px] font-bold transition-opacity hover:opacity-80 ${PRIORITY_MAP[item.priority as 0 | 1 | 2 | 3].color}`}
            >
              {PRIORITY_MAP[item.priority as 0 | 1 | 2 | 3].label}
            </button>
          </div>
          {item.note ? (
            <p className={`mt-1 line-clamp-2 text-sm ${isDone ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500 dark:text-zinc-400"}`}>{item.note}</p>
          ) : null}
          <div className="mt-2 flex items-center gap-4 text-xs font-semibold">
            {item.completedAt && isDone ? (
              <span className="flex items-center gap-1 text-rose-400/80">
                <CheckSquare className="h-3.5 w-3.5" />
                {formatDateTime(item.completedAt)}
              </span>
            ) : null}
            {!isDone && (item.startAt || item.dueAt) ? (
              <span className={`flex items-center gap-1 ${dueColorClass}`}>
                <CalendarDays className="h-3.5 w-3.5" />
                {item.startAt ? formatShortDate(item.startAt) : ""}
                {item.startAt && item.dueAt ? " - " : ""}
                {item.dueAt ? formatShortDate(item.dueAt) : ""}
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-l-xl bg-white/80 pl-2 opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100 dark:bg-zinc-900/80">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-lg p-2 text-zinc-400 transition-all hover:bg-rose-50 hover:text-rose-600"
              title="编辑任务"
            >
              <Edit2 className="h-4 w-4 stroke-[2]" />
            </button>
            <button
              type="button"
              onClick={() => {
                void handleDeleteItem(item.id);
              }}
              className="rounded-lg p-2 text-zinc-400 transition-all hover:bg-red-50 hover:text-red-600"
              title="删除任务"
            >
              <Trash2 className="h-4 w-4 stroke-[2]" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-transparent pb-20 font-sans text-zinc-900 selection:bg-rose-200 selection:text-rose-900 dark:text-zinc-100">
      <div className="animate-in fade-in mx-auto max-w-[1100px] px-4 pt-2 duration-700 sm:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            <section>
              <form
                onSubmit={(event) => {
                  void handleCreateItem(event);
                }}
                className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition-all duration-300 focus-within:border-rose-300 focus-within:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 flex-shrink-0 rounded border-2 border-zinc-300 transition-colors focus-within:border-rose-400" />
                    <input
                      type="text"
                      className="block w-full flex-1 border-none bg-transparent p-0 text-[1.05rem] font-medium text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-0 dark:text-zinc-100 dark:placeholder-zinc-500"
                      placeholder="准备做点什么？"
                      value={newItemTitle}
                      onChange={(event) => setNewItemTitle(event.target.value)}
                    />
                  </div>

                  {(showNoteInput || newItemNote) && (
                    <div className="animate-in slide-in-from-top-1 fade-in pl-8 pr-2 duration-200">
                      <textarea
                        className="w-full resize-none border-none bg-transparent p-0 text-sm text-zinc-600 placeholder-zinc-400 focus:outline-none focus:ring-0 dark:text-zinc-300 dark:placeholder-zinc-500"
                        placeholder="添加详细描述..."
                        rows={2}
                        value={newItemNote}
                        onChange={(event) => setNewItemNote(event.target.value)}
                        autoFocus={showNoteInput && !newItemNote}
                      />
                    </div>
                  )}

                  <div className="mt-1 flex items-center justify-between pl-8 pr-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className={`flex h-7 items-center rounded-md border px-2.5 shadow-sm transition-colors ${
                          newItemStartAt || newItemDueAt
                            ? "border-rose-200 bg-rose-50 text-rose-600"
                            : "border-zinc-200/80 bg-zinc-50 text-zinc-500 hover:bg-zinc-100"
                        }`}
                      >
                        <CalendarDays className="mr-2 h-3.5 w-3.5 opacity-70" />
                        <div className="relative flex items-center">
                          <span className="cursor-pointer text-[11px] font-semibold">{newItemStartAt ? formatShortDate(newItemStartAt) : "开始"}</span>
                          <input
                            type="date"
                            className="absolute inset-0 w-full cursor-pointer opacity-0"
                            value={newItemStartAt}
                            onChange={(event) => setNewItemStartAt(event.target.value)}
                          />
                        </div>
                        <span className="mx-1.5 text-[10px] opacity-40">→</span>
                        <div className="relative flex items-center">
                          <span className="cursor-pointer text-[11px] font-semibold">{newItemDueAt ? formatShortDate(newItemDueAt) : "截止"}</span>
                          <input
                            type="date"
                            className="absolute inset-0 w-full cursor-pointer opacity-0"
                            value={newItemDueAt}
                            onChange={(event) => setNewItemDueAt(event.target.value)}
                          />
                        </div>
                        {newItemStartAt || newItemDueAt ? (
                          <button
                            type="button"
                            onClick={() => {
                              setNewItemStartAt("");
                              setNewItemDueAt("");
                            }}
                            className="ml-2 text-rose-400 transition-colors hover:text-rose-600"
                            title="清除时间"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => setNewItemPriority((prev) => (prev + 1) % 4)}
                        className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold shadow-sm transition-all hover:opacity-80 ${PRIORITY_MAP[newItemPriority as 0 | 1 | 2 | 3].color}`}
                        title="点击切换优先级"
                      >
                        <Flag className="h-3.5 w-3.5" />
                        {PRIORITY_MAP[newItemPriority as 0 | 1 | 2 | 3].label}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowNoteInput((prev) => !prev)}
                        className={`flex h-7 w-7 items-center justify-center rounded-md border shadow-sm transition-colors ${
                          showNoteInput || newItemNote
                            ? "border-rose-200 bg-rose-50 text-rose-600"
                            : "border-zinc-200/80 bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                        }`}
                        title="添加备注"
                      >
                        <AlignLeft className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={!newItemTitle.trim() || isSubmitting}
                      className="group/btn flex h-7 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      保存
                      <CornerDownLeft className="h-3 w-3 opacity-50 transition-opacity group-hover/btn:opacity-100" />
                    </button>
                  </div>
                </div>
              </form>
            </section>

            <div className="mb-4 mt-8 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">进行中 ({stats.active})</h2>
              <div className="flex items-center rounded-lg border border-zinc-200/60 bg-zinc-200/50 p-1 shadow-inner dark:border-zinc-700 dark:bg-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                    viewMode === "list" ? "bg-white text-rose-600 shadow-sm dark:bg-zinc-700" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  普通列表
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("timeline")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                    viewMode === "timeline" ? "bg-white text-rose-600 shadow-sm dark:bg-zinc-700" : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <GanttChart className="h-3.5 w-3.5" />
                  甘特图区间
                </button>
              </div>
            </div>

            {viewMode === "list" ? (
              <section className="animate-in fade-in space-y-6 duration-300">
                {groupedActiveItems.length === 0 ? (
                  <div className="rounded-xl border border-zinc-200/50 border-dashed bg-zinc-50/50 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900/60">
                    <p className="text-sm font-medium text-zinc-400">暂无进行中的任务，休息一下吧 ☕️</p>
                  </div>
                ) : (
                  groupedActiveItems.map((group) => (
                    <div key={group.id} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-md border px-2.5 py-1 text-xs font-bold shadow-sm ${group.colorClass}`}>{group.label}</span>
                        <div className="h-px flex-1 bg-zinc-200/60" />
                      </div>
                      <div className="space-y-3">{group.items.map((item) => <TaskCard key={item.id} item={item} />)}</div>
                    </div>
                  ))
                )}
              </section>
            ) : (
              <section className="animate-in fade-in duration-300">
                {timelineGrid.length === 0 ? (
                  <div className="mb-6 rounded-xl border border-zinc-200/50 border-dashed bg-zinc-50/50 py-10 text-center">
                    <p className="text-sm font-medium text-zinc-400">还没有分配任何排期的任务</p>
                  </div>
                ) : (
                  <div className="mb-6 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                    <div className="custom-scrollbar overflow-x-auto">
                      <div className="flex min-w-max flex-col">
                        <div className="sticky top-0 z-20 flex border-b border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/70">
                          <div className="sticky left-0 z-30 flex w-[200px] shrink-0 items-center border-r border-zinc-200 bg-zinc-50/90 px-4 backdrop-blur dark:border-zinc-700 dark:bg-zinc-800/90">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">排期任务 ({scheduledItems.length})</span>
                          </div>
                          <div className="flex">
                            {timelineGrid.map((d) => {
                              const isToday = normalizeToStartOfDay(d) === normalizeToStartOfDay(new Date());
                              return (
                                <div
                                  key={d.toISOString()}
                                  className={`flex w-[48px] shrink-0 flex-col items-center justify-center border-r border-zinc-100 py-2 ${
                                    isToday ? "border-rose-100 bg-rose-50" : ""
                                  }`}
                                >
                                  <span className={`text-[9px] font-bold ${isToday ? "text-rose-400" : "text-zinc-400"}`}>
                                    {["日", "一", "二", "三", "四", "五", "六"][d.getDay()]}
                                  </span>
                                  <span className={`text-xs font-bold ${isToday ? "text-rose-600" : "text-zinc-700 dark:text-zinc-200"}`}>{d.getDate()}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {scheduledItems.map((item) => {
                          const tStart = parseDateLocal(item.startAt) ?? parseDateLocal(item.dueAt) ?? new Date();
                          const tEnd = parseDateLocal(item.dueAt) ?? parseDateLocal(item.startAt) ?? new Date();

                          const msPerDay = 24 * 60 * 60 * 1000;
                          const baseTime = normalizeToStartOfDay(timelineGrid[0]);
                          const sTime = normalizeToStartOfDay(tStart);
                          const eTime = normalizeToStartOfDay(tEnd);

                          let startIndex = Math.floor((sTime - baseTime) / msPerDay);
                          let duration = Math.floor((eTime - sTime) / msPerDay) + 1;

                          if (duration < 1) duration = 1;
                          if (startIndex < 0) {
                            duration += startIndex;
                            startIndex = 0;
                          }
                          if (startIndex + duration > timelineGrid.length) {
                            duration = timelineGrid.length - startIndex;
                          }

                          return (
                            <div key={item.id} className="group relative flex border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/60">
                              <div className="group-hover:bg-zinc-50/90 sticky left-0 z-20 flex w-[200px] shrink-0 items-center justify-between border-r border-zinc-200 bg-white/90 p-3 backdrop-blur transition-colors dark:border-zinc-700 dark:bg-zinc-900/90 dark:group-hover:bg-zinc-800/90">
                                <div className="flex items-center gap-2 truncate">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void handleToggleItemStatus(item.id, item.status);
                                    }}
                                    className="shrink-0 text-zinc-300 transition-colors hover:text-rose-500"
                                  >
                                    <Circle className="h-4 w-4" />
                                  </button>
                                  <span className="truncate text-sm font-semibold text-zinc-700 dark:text-zinc-200" title={item.title}>
                                    {item.title}
                                  </span>
                                </div>
                              </div>
                              <div className="relative flex">
                                {timelineGrid.map((d) => {
                                  const isToday = normalizeToStartOfDay(d) === normalizeToStartOfDay(new Date());
                                  return (
                                    <div
                                      key={d.toISOString()}
                                      className={`h-[44px] w-[48px] shrink-0 border-r border-zinc-100 ${isToday ? "bg-rose-50/30" : ""}`}
                                    />
                                  );
                                })}
                                {duration > 0 && startIndex < timelineGrid.length ? (
                                  <div
                                    className={`absolute bottom-[8px] top-[8px] flex cursor-pointer items-center truncate rounded-md border px-2 text-[10px] font-bold shadow-sm transition-all hover:brightness-95 ${getPriorityBarColors(
                                      item.priority,
                                    )}`}
                                    style={{ left: `${startIndex * 48 + 4}px`, width: `${duration * 48 - 8}px` }}
                                    onClick={() => {
                                      void handleChangePriority(item.id, item.priority);
                                    }}
                                    title={`点击切换优先级\n起: ${formatDate(item.startAt)}\n止: ${formatDate(item.dueAt)}`}
                                  >
                                    <span className="truncate">{item.title}</span>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {unscheduledItems.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <ListTodo className="h-4 w-4" />
                      无排期待办 ({unscheduledItems.length})
                    </h3>
                    <div className="space-y-3">{unscheduledItems.map((item) => <TaskCard key={item.id} item={item} />)}</div>
                  </div>
                ) : null}
              </section>
            )}

            {todayGroup ? (
              <section className="animate-in fade-in mt-12 duration-300">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex items-center gap-1.5 rounded-md border border-rose-200/60 bg-rose-100/80 px-2.5 py-1 text-xs font-bold text-rose-600 shadow-sm">
                    <Trophy className="h-4 w-4 text-rose-500" />
                    今天已完成
                  </span>
                  <div className="h-px flex-1 bg-zinc-200/60" />
                </div>
                <div className="space-y-3">{todayGroup.items.map((item) => <TaskCard key={item.id} item={item} />)}</div>
              </section>
            ) : null}

            {pastGroups.length > 0 ? (
              <section>
                <button
                  type="button"
                  onClick={() => setShowCompleted((prev) => !prev)}
                  className="mb-4 mt-8 flex items-center gap-1 text-sm font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  {showCompleted ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  历史已完成 ({doneItems.length - (todayGroup?.items.length || 0)})
                </button>

                {showCompleted ? (
                  <div className="animate-in slide-in-from-top-2 fade-in space-y-8 duration-300">
                    {pastGroups.slice(0, 6).map((group) => (
                      <div key={group.date} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="rounded-md border border-zinc-200/60 bg-zinc-100/80 px-2.5 py-1 text-xs font-bold text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {getRelativeDayName(group.date)}
                          </span>
                          <div className="h-px flex-1 bg-zinc-200/60" />
                        </div>
                        <div className="space-y-3">{group.items.map((item) => <TaskCard key={item.id} item={item} />)}</div>
                      </div>
                    ))}
                    {pastGroups.length > 6 ? (
                      <div className="py-4 text-center text-xs font-medium text-zinc-400">仅展示最近 7 天的记录</div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}
          </div>

          <div className="space-y-6 lg:col-span-4">
            <div className="sticky top-8 space-y-6">
              <div className={`rounded-xl border px-3 py-2 text-[12px] font-medium ${syncStatusClass}`}>{syncStatusText}</div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">今日概况</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50/50 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-rose-100 p-2 text-rose-600">
                        <Trophy className="h-5 w-5" />
                      </div>
                      <div className="text-sm font-medium text-zinc-600 dark:text-zinc-300">今日完成</div>
                    </div>
                    <div className="text-xl font-bold text-rose-600">{summaryView.completedToday}</div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-orange-100 bg-orange-50/50 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-orange-100 p-2 text-orange-500">
                        <Flame className="h-5 w-5" />
                      </div>
                      <div className="text-sm font-medium text-zinc-600 dark:text-zinc-300">连续专注 (天)</div>
                    </div>
                    <div className="text-xl font-bold text-orange-600">{summaryView.currentStreak}</div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50 p-3.5 dark:border-zinc-700 dark:bg-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg border border-zinc-200/50 bg-white p-2 text-zinc-400 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                        <Target className="h-5 w-5" />
                      </div>
                      <div className="text-sm font-medium text-zinc-600 dark:text-zinc-300">剩余待办</div>
                    </div>
                    <div className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{summaryView.active}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <div className="mb-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                      <Calendar className="h-4 w-4 text-rose-500" />
                      打卡日历
                    </h3>
                    <div className="flex items-center gap-1 rounded-lg border border-zinc-200/60 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800">
                      <button
                        type="button"
                        onClick={handlePrevPeriod}
                        className="rounded p-1 text-zinc-400 shadow-sm transition-all hover:bg-white hover:text-rose-600 dark:hover:bg-zinc-700"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleNextPeriod}
                        disabled={isLatestPeriod}
                        className="rounded p-1 text-zinc-400 shadow-sm transition-all hover:bg-white hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400 disabled:shadow-none dark:hover:bg-zinc-700"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="w-fit text-[12px] font-bold text-zinc-700 dark:text-zinc-300">{heatmapDateRange}</div>
                </div>

                <div className="mb-2 grid grid-cols-7 gap-1">
                  {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                    <div key={day} className="py-1 text-center text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarData.map((day) => {
                    const isToday = day.date === todayString;
                    let cellClasses = "bg-transparent text-zinc-300 opacity-40";
                    if (day.isCurrentMonth) {
                      if (day.count === 0) cellClasses = "bg-zinc-100/60 text-zinc-500 hover:bg-zinc-200/60";
                      else if (day.count <= 1) cellClasses = "bg-rose-200 text-rose-800 font-bold";
                      else if (day.count <= 3) cellClasses = "bg-rose-300 text-rose-900 font-bold";
                      else if (day.count <= 5) cellClasses = "bg-rose-400 text-white font-bold";
                      else cellClasses = "bg-rose-500 text-white font-bold";
                    }
                    return (
                      <div
                        key={day.date}
                        title={day.isCurrentMonth ? `${day.date}: 完成 ${day.count} 个任务` : ""}
                        className={`aspect-square w-full rounded-[6px] text-xs transition-all duration-200 ${
                          day.isCurrentMonth ? "cursor-crosshair" : "cursor-default"
                        } ${cellClasses} ${
                          isToday ? "ring-2 ring-rose-400 ring-offset-[1px]" : day.isCurrentMonth ? "hover:ring-2 hover:ring-rose-300" : ""
                        } flex items-center justify-center`}
                      >
                        {day.isCurrentMonth ? day.dayNum : ""}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex items-center justify-end text-[10px] font-semibold text-zinc-400">
                  <div className="flex items-center gap-1">
                    <span>少</span>
                    <div className="flex gap-[2px]">
                      {[0, 1, 3, 5, 10].map((val) => (
                        <div key={val} className={`h-[12px] w-[12px] rounded-[2px] ${getHeatmapColor(val)}`} />
                      ))}
                    </div>
                    <span>多</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #fafafa; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e4e4e7; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d4d4d8; }
        .dark .custom-scrollbar::-webkit-scrollbar-track { background: #111827; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>
    </div>
  );
}
