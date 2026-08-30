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

  /** Ownership guard for owner-side operations. */
  const requireOwnedConversation = async (id: string, ownerId: string) => {
    const [row] = await db
      .select({ conversation: conversations })
      .from(conversations)
      .innerJoin(agents, eq(conversations.agentId, agents.id))
      .innerJoin(domains, eq(agents.domainId, domains.id))
      .where(
        and(eq(conversations.id, id), eq(domains.ownerId, ownerId)),
      )
      .limit(1);
    if (!row) throw notFound();
    return row.conversation;
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

    /** A conversation only if it belongs to a domain owned by `ownerId`. */
    getConversationForOwner: async (id: string, ownerId: string) => {
      const [row] = await db
        .select({
          conversation: conversations,
          agentName: agents.name,
          domainSlug: domains.slug,
          domainName: domains.name,
        })
        .from(conversations)
        .innerJoin(agents, eq(conversations.agentId, agents.id))
        .innerJoin(domains, eq(agents.domainId, domains.id))
        .where(
          and(eq(conversations.id, id), eq(domains.ownerId, ownerId)),
        )
        .limit(1);

      if (!row) throw notFound();
      return {
        ...row.conversation,
        agentName: row.agentName,
        domainSlug: row.domainSlug,
        domainName: row.domainName,
      };
    },

    /** Conversations across all domains of an owner, newest activity first. */
    listConversationsForOwner: async (ownerId: string, limit = 100) => {
      const rows = await db
        .select({
          conversation: conversations,
          agentName: agents.name,
          domainSlug: domains.slug,
          domainName: domains.name,
        })
        .from(conversations)
        .innerJoin(agents, eq(conversations.agentId, agents.id))
        .innerJoin(domains, eq(agents.domainId, domains.id))
        .where(eq(domains.ownerId, ownerId))
        .orderBy(desc(conversations.updatedAt))
        .limit(limit);

      const ids = rows.map((row) => row.conversation.id);
      let allMessages: typeof messages.$inferSelect[] = [];
      if (ids.length > 0) {
        allMessages = await db
          .select()
          .from(messages)
          .where(inArray(messages.conversationId, ids))
          .orderBy(messages.createdAt);
      }
      const byConversation = new Map<string, typeof allMessages>();
      for (const message of allMessages) {
        const list = byConversation.get(message.conversationId) ?? [];
        list.push(message);
        byConversation.set(message.conversationId, list);
      }

      return rows.map(({ conversation, agentName, domainSlug, domainName }) => {
        const msgs = byConversation.get(conversation.id) ?? [];
        const last = msgs[msgs.length - 1] ?? null;
        const unread = msgs.filter(
          (m) =>
            m.sender !== "owner" &&
            m.createdAt.getTime() > conversation.ownerSeenAt.getTime(),
        ).length;

        // Derive title from the first user message (truncated to 60 chars)
        const firstUserMsg = msgs.find((m) => m.role === "user");
        const derivedTitle =
          conversation.title ??
          (firstUserMsg
            ? firstUserMsg.content.length > 60
              ? firstUserMsg.content.slice(0, 60) + "…"
              : firstUserMsg.content
            : null);

        return {
          ...conversation,
          title: derivedTitle,
          agentName,
          domainSlug,
          domainName,
          lastMessage: last
            ? {
                content: last.content,
                sender: last.sender,
                createdAt: last.createdAt,
              }
            : null,
          unread,
        };
      });
    },

    /** Messages created after `since`, optionally restricted to a sender. */
    listMessagesSince: async (
      id: string,
      since: Date,
      sender?: "visitor" | "owner" | "assistant",
    ) => {
      await requireConversation(id);
      const filters = [
        eq(messages.conversationId, id),
        gte(messages.createdAt, since),
      ];
      if (sender) filters.push(eq(messages.sender, sender));
      const rows = await db
        .select()
        .from(messages)
        .where(and(...filters))
        .orderBy(messages.createdAt);
      return rows;
    },

    /** Owner replies to a conversation; rejects closed/resolved ones. */
    appendOwnerMessage: async (
      id: string,
      ownerId: string,
      content: string,
    ) => {
      const conversation = await requireOwnedConversation(id, ownerId);
      if (
        conversation.status === "resolved" ||
        conversation.status === "closed"
      ) {
        throw new ConversationServiceError(
          409,
          "CONVERSATION_CLOSED",
          "This conversation is closed; reopen it to reply",
        );
      }
      const message = await db
        .insert(messages)
        .values({
          conversationId: id,
          role: "user",
          sender: "owner",
          content,
        })
        .returning();
      const created = message[0];
      if (!created) {
        throw new Error("Failed to insert message");
      }
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, id));
      return created;
    },

    /** Marks the conversation as seen by the owner (clears unread). */
    markConversationSeen: async (id: string, ownerId: string) => {
      await requireOwnedConversation(id, ownerId);
      await db
        .update(conversations)
        .set({ ownerSeenAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, id));
    },

    /** Status change scoped to the owner (resolve/close/reopen/…). */
    setConversationStatusForOwner: async (
      id: string,
      ownerId: string,
      status: "active" | "escalated" | "resolved" | "closed",
    ) => {
      await requireOwnedConversation(id, ownerId);
      const [updated] = await db
        .update(conversations)
        .set({ status, updatedAt: new Date() })
        .where(eq(conversations.id, id))
        .returning();
      return updated;
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
        sender?: "visitor" | "owner" | "assistant";
      },
    ) => {
      const body = appendMessageSchema.parse(input);
      await requireConversation(conversationId);

      const sender =
        body.sender ?? (body.role === "user" ? "visitor" : "assistant");
      const [row] = await db
        .insert(messages)
        .values({
          conversationId,
          role: body.role,
          sender,
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
