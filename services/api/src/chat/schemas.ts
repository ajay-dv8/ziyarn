import { z } from "zod";

export const conversationIdSchema = z.object({
  id: z.string().uuid("Invalid conversation id"),
});

export const visitorIdSchema = z
  .string()
  .trim()
  .min(8, "Visitor id is required")
  .max(128, "Visitor id must be at most 128 characters");

export const sendMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(4000, "Message must be at most 4000 characters"),
  conversationId: z.string().uuid("Invalid conversation id").optional(),
  visitorId: visitorIdSchema,
});

export const appendMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().max(16000),
  toolCallId: z.string().uuid().optional(),
  metadata: z.string().max(4000).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type AppendMessageInput = z.infer<typeof appendMessageSchema>;
export type ConversationIdInput = z.infer<typeof conversationIdSchema>;
