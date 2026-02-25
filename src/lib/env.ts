const fallbackUmsApiBaseUrl = "http://localhost:8080";
const fallbackTodoApiBaseUrl = "http://localhost:8081";

export function getServerUmsApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_UMS_API_BASE_URL ?? fallbackUmsApiBaseUrl;
}

export function getPublicUmsApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_UMS_API_BASE_URL ?? fallbackUmsApiBaseUrl;
}

export function getServerTodoApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_TODO_API_BASE_URL ?? fallbackTodoApiBaseUrl;
}
