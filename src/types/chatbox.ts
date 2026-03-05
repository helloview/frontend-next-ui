export type ChatboxProvider = "gemini" | "ollama";
export type ChatboxContentType = "text" | "image";

export type ChatboxProviderCatalog = {
  textModels: string[];
  imageModels: string[];
  defaultTextModel: string;
  defaultImageModel: string;
};

export type ChatboxModelsResponse = {
  providers: Record<ChatboxProvider, ChatboxProviderCatalog>;
  warnings?: string[];
};

export type ChatboxConversation = {
  id: number;
  title: string;
  provider: ChatboxProvider;
  model: string;
  content_type: ChatboxContentType;
  last_message_preview: string;
  last_message_type: string;
  created_at: string;
  updated_at: string;
};

export type ChatboxMessage = {
  id: number | string;
  conversation_id: number;
  role: "user" | "assistant";
  content_type: ChatboxContentType;
  content: string;
  thinking?: string;
  image_url: string;
  image_base64: string;
  provider: ChatboxProvider;
  model: string;
  status: "success" | "failed" | "streaming";
  error: string;
  created_at: string;
};

export type ChatboxConversationListResponse = {
  items: ChatboxConversation[];
  count: number;
};

export type ChatboxMessageListResponse = {
  items: ChatboxMessage[];
  count: number;
};

export type ChatboxSendMessageResponse = {
  conversation: ChatboxConversation;
  user_message: ChatboxMessage;
  assistant_message: ChatboxMessage;
};
