import type { TodoHeatmap, TodoItem, TodoSummary } from "@/types/todo";

const STORAGE_KEY_PREFIX = "helloview.todo.offline.v2";

type TodoCreatePayload = {
  title: string;
  note: string;
  priority: number;
  startAt?: string;
  dueAt?: string;
};

type TodoUpdatePayload = {
  title?: string;
  note?: string;
  priority?: number;
  startAt?: string | null;
  dueAt?: string | null;
};

export type TodoOfflineOperation =
  | {
      type: "create";
      clientId: string;
      payload: TodoCreatePayload;
      createdAt: string;
    }
  | {
      type: "update";
      itemId: string;
      payload: TodoUpdatePayload;
      createdAt: string;
    }
  | {
      type: "complete" | "reopen" | "delete";
      itemId: string;
      createdAt: string;
    };

export type TodoOfflineSnapshot = {
  items: TodoItem[];
  queue: TodoOfflineOperation[];
  updatedAt: string;
};

function nowISO() {
  return new Date().toISOString();
}

function getStorageKey(namespace: string) {
  const safeNamespace = namespace.trim() || "anonymous";
  return `${STORAGE_KEY_PREFIX}:${safeNamespace}`;
}

function emptySnapshot(): TodoOfflineSnapshot {
  return {
    items: [],
    queue: [],
    updatedAt: nowISO(),
  };
}

function parseDate(input?: string | null) {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKeyLocal(input?: string | null) {
  const date = parseDate(input);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function generateLocalTodoID() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadTodoOfflineSnapshot(namespace: string): TodoOfflineSnapshot {
  if (typeof window === "undefined") {
    return emptySnapshot();
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(namespace));
    if (!raw) return emptySnapshot();
    const parsed = JSON.parse(raw) as Partial<TodoOfflineSnapshot>;
    if (!Array.isArray(parsed.items) || !Array.isArray(parsed.queue)) {
      return emptySnapshot();
    }
    return {
      items: parsed.items,
      queue: parsed.queue,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowISO(),
    };
  } catch {
    return emptySnapshot();
  }
}

export function saveTodoOfflineSnapshot(namespace: string, snapshot: TodoOfflineSnapshot) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getStorageKey(namespace), JSON.stringify(snapshot));
}

export function replaceTodoItem(items: TodoItem[], next: TodoItem): TodoItem[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) {
    return [next, ...items];
  }
  const cloned = [...items];
  cloned[index] = next;
  return cloned;
}

export function mergeTodoItems(...groups: TodoItem[][]): TodoItem[] {
  const map = new Map<string, TodoItem>();
  for (const group of groups) {
    for (const item of group) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

export function applyTodoOfflineOperation(items: TodoItem[], op: TodoOfflineOperation): TodoItem[] {
  if (op.type === "create") {
    const createdAt = op.createdAt || nowISO();
    return [
      {
        id: op.clientId,
        title: op.payload.title,
        note: op.payload.note,
        status: "open",
        priority: op.payload.priority,
        startAt: op.payload.startAt || null,
        dueAt: op.payload.dueAt || null,
        completedAt: null,
        createdAt,
        updatedAt: createdAt,
      },
      ...items,
    ];
  }

  if (op.type === "update") {
    return items.map((item) => {
      if (item.id !== op.itemId) return item;
      return {
        ...item,
        ...(op.payload.title !== undefined ? { title: op.payload.title } : {}),
        ...(op.payload.note !== undefined ? { note: op.payload.note } : {}),
        ...(op.payload.priority !== undefined ? { priority: op.payload.priority } : {}),
        ...(op.payload.startAt !== undefined ? { startAt: op.payload.startAt } : {}),
        ...(op.payload.dueAt !== undefined ? { dueAt: op.payload.dueAt } : {}),
        updatedAt: op.createdAt || nowISO(),
      };
    });
  }

  if (op.type === "complete") {
    const completedAt = op.createdAt || nowISO();
    return items.map((item) => {
      if (item.id !== op.itemId) return item;
      return {
        ...item,
        status: "done",
        completedAt,
        updatedAt: completedAt,
      };
    });
  }

  if (op.type === "reopen") {
    return items.map((item) => {
      if (item.id !== op.itemId) return item;
      return {
        ...item,
        status: "open",
        completedAt: null,
        updatedAt: op.createdAt || nowISO(),
      };
    });
  }

  return items.filter((item) => item.id !== op.itemId);
}

export function queueTodoOfflineOperation(snapshot: TodoOfflineSnapshot, op: TodoOfflineOperation): TodoOfflineSnapshot {
  return {
    items: applyTodoOfflineOperation(snapshot.items, op),
    queue: [...snapshot.queue, op],
    updatedAt: nowISO(),
  };
}

export function sortOpenTodoItems(items: TodoItem[]): TodoItem[] {
  return [...items]
    .filter((item) => item.status === "open")
    .sort((a, b) => {
      if (a.dueAt && !b.dueAt) return -1;
      if (!a.dueAt && b.dueAt) return 1;
      if (a.dueAt && b.dueAt) {
        const aTime = parseDate(a.dueAt)?.getTime() ?? 0;
        const bTime = parseDate(b.dueAt)?.getTime() ?? 0;
        if (aTime !== bTime) return aTime - bTime;
      }
      if (a.priority !== b.priority) return b.priority - a.priority;
      const aCreated = parseDate(a.createdAt)?.getTime() ?? 0;
      const bCreated = parseDate(b.createdAt)?.getTime() ?? 0;
      return bCreated - aCreated;
    });
}

export function listDoneTodoItems(items: TodoItem[], days: number): TodoItem[] {
  const now = new Date();
  const threshold = now.getTime() - Math.max(days, 1) * 24 * 60 * 60 * 1000;
  return [...items]
    .filter((item) => item.status === "done" && parseDate(item.completedAt)?.getTime() && (parseDate(item.completedAt)?.getTime() ?? 0) >= threshold)
    .sort((a, b) => {
      const aTime = parseDate(a.completedAt)?.getTime() ?? 0;
      const bTime = parseDate(b.completedAt)?.getTime() ?? 0;
      return bTime - aTime;
    });
}

export function buildLocalTodoSummary(items: TodoItem[]): TodoSummary {
  const active = items.filter((item) => item.status === "open").length;
  const todayKey = toDateKeyLocal(nowISO());
  const doneKeys = new Set<string>();

  let completedToday = 0;
  for (const item of items) {
    if (item.status !== "done" || !item.completedAt) continue;
    const key = toDateKeyLocal(item.completedAt);
    if (!key) continue;
    doneKeys.add(key);
    if (key === todayKey) {
      completedToday += 1;
    }
  }

  let streak = 0;
  const cursor = new Date();
  if (!doneKeys.has(toDateKeyLocal(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (doneKeys.has(toDateKeyLocal(cursor.toISOString()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    active,
    completedToday,
    currentStreak: streak,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Local",
  };
}

export function buildLocalTodoHeatmap(items: TodoItem[], monthRef: Date): TodoHeatmap {
  const year = monthRef.getFullYear();
  const month = monthRef.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());

  const gridEnd = new Date(last);
  gridEnd.setDate(last.getDate() + (6 - last.getDay()));

  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.status !== "done" || !item.completedAt) continue;
    const key = toDateKeyLocal(item.completedAt);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const days = [] as TodoHeatmap["days"];
  for (let cursor = new Date(gridStart); cursor <= gridEnd; cursor.setDate(cursor.getDate() + 1)) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    days.push({
      date: key,
      count: counts.get(key) ?? 0,
      isCurrentMonth: cursor.getMonth() === month,
    });
  }

  return {
    month: `${year}-${String(month + 1).padStart(2, "0")}`,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Local",
    range: {
      from: `${gridStart.getFullYear()}-${String(gridStart.getMonth() + 1).padStart(2, "0")}-${String(gridStart.getDate()).padStart(2, "0")}`,
      to: `${gridEnd.getFullYear()}-${String(gridEnd.getMonth() + 1).padStart(2, "0")}-${String(gridEnd.getDate()).padStart(2, "0")}`,
    },
    days,
  };
}
