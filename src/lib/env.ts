const fallbackUmsApiBaseUrl = "http://localhost:8080";
const fallbackTodoApiBaseUrl = "http://localhost:8081";
const fallbackStudioApiBaseUrl = "http://localhost:8083";
const fallbackGeminiLlmApiBaseUrl = "http://localhost:8080/gemini";
const fallbackOllamaLlmApiBaseUrl = "http://localhost:8080/ollama";
const fallbackR2ServiceApiBaseUrl = "http://localhost:8080/r2";
const fallbackIndexTtsApiBaseUrl = "http://localhost:8080/indextts";
const fallbackChatboxApiBaseUrl = "http://localhost:8080/chatbox";

export function getServerUmsApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_UMS_API_BASE_URL ?? fallbackUmsApiBaseUrl;
}

export function getPublicUmsApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_UMS_API_BASE_URL ?? fallbackUmsApiBaseUrl;
}

export function getServerTodoApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_TODO_API_BASE_URL ?? fallbackTodoApiBaseUrl;
}

export function getServerStudioApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_STUDIO_API_BASE_URL ?? fallbackStudioApiBaseUrl;
}

export function getServerGeminiLlmApiBaseUrl(): string {
  return process.env.GEMINI_LLM_API_BASE_URL ?? fallbackGeminiLlmApiBaseUrl;
}

export function getServerOllamaLlmApiBaseUrl(): string {
  return process.env.OLLAMA_LLM_API_BASE_URL ?? fallbackOllamaLlmApiBaseUrl;
}

export function getServerR2ServiceApiBaseUrl(): string {
  return process.env.R2_SERVICE_API_BASE_URL ?? fallbackR2ServiceApiBaseUrl;
}

export function getServerIndexTtsApiBaseUrl(): string {
  return process.env.INDEXTTS_API_BASE_URL ?? fallbackIndexTtsApiBaseUrl;
}

export function getServerChatboxApiBaseUrl(): string {
  return process.env.CHATBOX_API_BASE_URL ?? fallbackChatboxApiBaseUrl;
}
