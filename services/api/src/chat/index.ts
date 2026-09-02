export {
  createChatService,
  ConversationServiceError,
  CONTEXT_WINDOW_MESSAGES,
  CORS_HEADERS,
  jsonError,
  systemPromptFor,
  handleChatPost,
  handleChatConfig,
  handleChatHistory,
} from "@repo/api/chat/server";

export type { ChatService } from "@repo/api/chat/server";

export { createToolExecutor } from "@repo/api/chat/tool-executor";

export {
  appendMessageSchema,
  conversationIdSchema,
  conversationStatusSchema,
  ownerReplySchema,
  sendMessageSchema,
  visitorIdSchema,
} from "@repo/api/chat/schemas";

export type {
  AppendMessageInput,
  ConversationIdInput,
  ConversationStatusInput,
  OwnerReplyInput,
  SendMessageInput,
} from "@repo/api/chat/schemas";
