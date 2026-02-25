export type TodoItem = {
  id: string;
  title: string;
  note: string;
  status: "open" | "done";
  priority: number;
  startAt?: string | null;
  dueAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TodoItemsResponse = {
  items: TodoItem[];
  count: number;
};

export type TodoSummary = {
  active: number;
  completedToday: number;
  currentStreak: number;
  timezone: string;
};

export type TodoHeatmapDay = {
  date: string;
  count: number;
  isCurrentMonth: boolean;
};

export type TodoHeatmap = {
  month: string;
  tz: string;
  range: {
    from: string;
    to: string;
  };
  days: TodoHeatmapDay[];
};
