export {
  createChatService,
  ConversationServiceError,
  CONTEXT_WINDOW_MESSAGES,
} from "@repo/api/chat/server";

export type { ChatService } from "@repo/api/chat/server";

export {
  appendMessageSchema,
  conversationIdSchema,
  sendMessageSchema,
  visitorIdSchema,
} from "@repo/api/chat/schemas";

export type {
  AppendMessageInput,
  ConversationIdInput,
  SendMessageInput,
} from "@repo/api/chat/schemas";
