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
  /**
   * Composer "Deep search" toggle. When explicitly false the knowledge tool is
   * withheld for this turn, so the model answers from its own knowledge instead
   * of the owner's knowledge base — cheaper, faster, and occasionally what a
   * visitor actually wants.
   *
   * Optional and default-true: an older widget that omits this field keeps the
   * previous behaviour, and `answer_knowledge` still only ever runs if the
   * agent has it enabled in its own tool list.
   */
  deepSearch: z.boolean().optional(),
});

export const appendMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().max(16000),
  toolCallId: z.string().uuid().optional(),
  metadata: z.string().max(4000).optional(),
  sender: z.enum(["visitor", "owner", "assistant"]).optional(),
});

export const ownerReplySchema = z.object({
  conversationId: z.string().uuid("Invalid conversation id"),
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(4000, "Message must be at most 4000 characters"),
});

export const conversationStatusSchema = z.object({
  id: z.string().uuid("Invalid conversation id"),
  status: z.enum(["active", "escalated", "resolved", "closed"]),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type AppendMessageInput = z.infer<typeof appendMessageSchema>;
export type ConversationIdInput = z.infer<typeof conversationIdSchema>;
export type OwnerReplyInput = z.infer<typeof ownerReplySchema>;
export type ConversationStatusInput = z.infer<typeof conversationStatusSchema>;
