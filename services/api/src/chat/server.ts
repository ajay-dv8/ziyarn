import { and, count, desc, eq, gte, inArray } from "drizzle-orm";

import type { Database } from "@repo/database";
import { agents, conversations, domains, messages } from "@repo/database/schema";

import { appendMessageSchema } from "@repo/api/chat/schemas";

export class ConversationServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ConversationServiceError";
  }
}

const notFound = () =>
  new ConversationServiceError(404, "NOT_FOUND", "Conversation not found");

const forbidden = () =>
  new ConversationServiceError(403, "FORBIDDEN", "Domain secret mismatch");

export const CONTEXT_WINDOW_MESSAGES = 20;

/**
 * Public chat persistence: conversations and messages keyed by a widget
 * visitor. No session user here — the caller (chat API route) authenticates
 * the domain via embed secret and enforces plan limits.
 */
export function createChatService(deps: { db: Database }) {
  const { db } = deps;

  const requireConversation = async (id: string) => {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);
    if (!conversation) throw notFound();
    return conversation;
  };

  return {
    /** Resolves a domain by its embed secret (public widget auth). */
    resolveDomainBySecret: async (secret: string) => {
      const [domain] = await db
        .select()
        .from(domains)
        .where(eq(domains.embedSecret, secret))
        .limit(1);
      if (!domain) throw forbidden();
      return domain;
    },

    /** Returns the first agent of a domain (P3: one default agent). */
    defaultAgentForDomain: async (domainId: string) => {
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.domainId, domainId))
        .orderBy(agents.createdAt)
        .limit(1);
      return agent ?? null;
    },

    /** Reuses an open conversation for a visitor or creates a new one. */
    findOrCreateConversation: async (input: {
      agentId: string;
      visitorId: string;
    }) => {
      const [existing] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.agentId, input.agentId),
            eq(conversations.visitorId, input.visitorId),
            eq(conversations.status, "active"),
          ),
        )
        .orderBy(desc(conversations.createdAt))
        .limit(1);

      if (existing) return existing;

      const [created] = await db
        .insert(conversations)
        .values({
          agentId: input.agentId,
          visitorId: input.visitorId,
        })
        .returning();
      if (!created) {
        throw new Error("Failed to create conversation");
      }
      return created;
    },

    getConversation: async (id: string) => {
      return requireConversation(id);
    },

    /** A conversation only if its agent belongs to the given domain. */
    getConversationForDomain: async (id: string, domainId: string) => {
      const [row] = await db
        .select({ conversation: conversations })
        .from(conversations)
        .innerJoin(agents, eq(conversations.agentId, agents.id))
        .where(
          and(eq(conversations.id, id), eq(agents.domainId, domainId)),
        )
        .limit(1);

      if (!row) throw notFound();
      return row.conversation;
    },

    /** Conversation count for a domain since local midnight (plan limit). */
    countDomainConversationsToday: async (domainId: string) => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const agentIds = db
        .select({ id: agents.id })
        .from(agents)
        .where(eq(agents.domainId, domainId));

      const [row] = await db
        .select({ count: count() })
        .from(conversations)
        .where(
          and(
            gte(conversations.createdAt, startOfDay),
            inArray(conversations.agentId, agentIds),
          ),
        );

      return row?.count ?? 0;
    },

    /** Messages of a conversation, oldest first, capped at `limit`. */
    listMessages: async (id: string, limit = 100) => {
      await requireConversation(id);
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, id))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
      return rows.reverse();
    },

    /** Last N user/assistant messages for the AI context window. */
    contextMessages: async (id: string, limit = CONTEXT_WINDOW_MESSAGES) => {
      await requireConversation(id);
      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, id))
        .orderBy(desc(messages.createdAt))
        .limit(limit);
      const context: {
        role: "user" | "assistant";
        content: string;
      }[] = [];
      for (const row of rows.reverse()) {
        if (row.role === "user" || row.role === "assistant") {
          context.push({ role: row.role, content: row.content });
        }
      }
      return context;
    },

    /** Appends a message; bumps the conversation updatedAt. */
    appendMessage: async (
      conversationId: string,
      input: {
        role: "user" | "assistant" | "system" | "tool";
        content: string;
        toolCallId?: string;
        metadata?: string;
      },
    ) => {
      const body = appendMessageSchema.parse(input);
      await requireConversation(conversationId);

      const [row] = await db
        .insert(messages)
        .values({
          conversationId,
          role: body.role,
          content: body.content,
          ...(body.toolCallId ? { toolCallId: body.toolCallId } : {}),
          ...(body.metadata ? { metadata: body.metadata } : {}),
        })
        .returning();

      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId));

      return row;
    },

    /** Marks a conversation (e.g. escalated by the agent). */
    setConversationStatus: async (
      id: string,
      status: "active" | "escalated" | "resolved" | "closed",
    ) => {
      await requireConversation(id);
      const [updated] = await db
        .update(conversations)
        .set({ status, updatedAt: new Date() })
        .where(eq(conversations.id, id))
        .returning();
      return updated;
    },
  };
}

export type ChatService = ReturnType<typeof createChatService>;
