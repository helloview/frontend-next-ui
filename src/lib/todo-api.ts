import { apiRequest } from "@/lib/api/client";
import { getServerTodoApiBaseUrl } from "@/lib/env";
import type { TodoHeatmap, TodoItem, TodoItemsResponse, TodoSummary } from "@/types/todo";

type TodoRequestBase = {
  accessToken: string;
};

function todoBase() {
  return getServerTodoApiBaseUrl();
}

export async function createTodoItem(
  input: {
    title: string;
    note?: string;
    priority?: number;
    startAt?: string;
    dueAt?: string;
  } & TodoRequestBase,
): Promise<TodoItem> {
  return apiRequest<TodoItem>("/v1/todos/items", {
    method: "POST",
    accessToken: input.accessToken,
    baseUrl: todoBase(),
    body: {
      title: input.title,
      note: input.note ?? "",
      priority: input.priority ?? 0,
      startAt: input.startAt ?? "",
      dueAt: input.dueAt ?? "",
    },
  });
}

export async function listTodoItems(
  input: {
    status?: "open" | "done";
    days?: number;
    limit?: number;
    offset?: number;
  } & TodoRequestBase,
): Promise<TodoItemsResponse> {
  const params = new URLSearchParams();
  if (input.status) params.set("status", input.status);
  if (typeof input.days === "number") params.set("days", String(input.days));
  if (typeof input.limit === "number") params.set("limit", String(input.limit));
  if (typeof input.offset === "number") params.set("offset", String(input.offset));

  const query = params.toString();
  return apiRequest<TodoItemsResponse>(`/v1/todos/items${query ? `?${query}` : ""}`, {
    accessToken: input.accessToken,
    baseUrl: todoBase(),
  });
}

export async function updateTodoItem(
  input: {
    itemID: string;
    title?: string;
    note?: string;
    priority?: number;
    startAt?: string | null;
    dueAt?: string | null;
  } & TodoRequestBase,
): Promise<TodoItem> {
  return apiRequest<TodoItem>(`/v1/todos/items/${input.itemID}`, {
    method: "PATCH",
    accessToken: input.accessToken,
    baseUrl: todoBase(),
    body: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
    },
  });
}

export async function completeTodoItem(input: { itemID: string } & TodoRequestBase): Promise<TodoItem> {
  return apiRequest<TodoItem>(`/v1/todos/items/${input.itemID}/complete`, {
    method: "POST",
    accessToken: input.accessToken,
    baseUrl: todoBase(),
  });
}

export async function reopenTodoItem(input: { itemID: string } & TodoRequestBase): Promise<TodoItem> {
  return apiRequest<TodoItem>(`/v1/todos/items/${input.itemID}/reopen`, {
    method: "POST",
    accessToken: input.accessToken,
    baseUrl: todoBase(),
  });
}

export async function deleteTodoItem(input: { itemID: string } & TodoRequestBase): Promise<void> {
  await apiRequest<void>(`/v1/todos/items/${input.itemID}`, {
    method: "DELETE",
    accessToken: input.accessToken,
    baseUrl: todoBase(),
  });
}

export async function getTodoHeatmap(input: { month?: string } & TodoRequestBase): Promise<TodoHeatmap> {
  const query = input.month ? `?month=${encodeURIComponent(input.month)}` : "";
  return apiRequest<TodoHeatmap>(`/v1/todos/heatmap${query}`, {
    accessToken: input.accessToken,
    baseUrl: todoBase(),
  });
}

export async function getTodoSummary(input: TodoRequestBase): Promise<TodoSummary> {
  return apiRequest<TodoSummary>("/v1/todos/summary", {
    accessToken: input.accessToken,
    baseUrl: todoBase(),
  });
}
