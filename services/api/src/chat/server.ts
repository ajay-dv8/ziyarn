import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  agents,
  conversations,
  domains,
  messages,
  products,
  bookingSettings,
} from "@repo/database/schema";
import type { AgentToolName } from "@repo/ai";
import { currencyCode, formatDecimal } from "@repo/money";
import { getPlanLimits, PlanLimitError } from "@repo/api/plans";
import {
  sendMessageSchema,
  type SendMessageInput,
} from "@repo/api/chat/schemas";
import type { PortalService } from "@repo/api/portal/server";
import type { KnowledgeService } from "@repo/api/knowledge/server";
import { createToolExecutor } from "@repo/api/chat/tool-executor";

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

/** CORS headers — widget runs inside arbitrary host pages. */
export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-embed-secret",
};

/** JSON error helper with CORS headers. */
export function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: CORS_HEADERS });
}

/** Default system prompt when agent has no custom prompt. */
const DEFAULT_SYSTEM_PROMPT = `You are a friendly sales and support assistant for this business.
Help visitors with their questions, qualify their interest, and move them toward booking a call or buying.
Be concise, honest and helpful. Never invent company facts you are unsure about.
If a visitor asks for a human, is frustrated, or the request is out of scope, escalate to a human agent.`;

/** Assembles the full system prompt from 8 parts concatenated at runtime. */
export function systemPromptFor(
  domain: { slug: string },
  agent: {
    name: string | null;
    description: string | null;
    instructions: string | null;
    systemPrompt: string | null;
    tools: string[] | null;
    filterQuestions: unknown;
  },
  catalog: { name: string; priceCents: number; currency: string }[],
  bookingConfig?: {
    availableDays: number[];
    availableStart: string;
    availableEnd: string;
    slotDuration: number;
    minNoticeHours: number;
  } | null,
): string {
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const filterQuestions = Array.isArray(agent.filterQuestions)
    ? agent.filterQuestions.filter((question): question is string => typeof question === "string" && question.trim().length > 0)
    : [];
  const catalogLine = catalog.length > 0
    ? `Product catalog (sell ONLY from this list, using sell_product; never invent prices):\n${catalog
        .map((product) => `- ${product.name} — ${formatDecimal({ amountMinor: product.priceCents, currency: product.currency })} ${currencyCode({ amountMinor: product.priceCents, currency: product.currency })}`)
        .join("\n")}`
    : "There are no products in the catalog yet. Direct purchase interest to create_payment for a custom amount, or offer to escalate.";
  const filterLine = filterQuestions.length > 0
    ? `Before capturing an email, name or offering to sell, ask these filter questions one at a time (do not dump them all at once):\n${filterQuestions.map((question) => `- ${question}`).join("\n")}\nWhen the visitor has answered, call capture_email and include the answers in its answers argument.`
    : "";
  const bookingLine = bookingConfig
    ? `Booking availability: ${DAY_NAMES.filter((_, dayIndex) => bookingConfig.availableDays.includes(dayIndex)).join(", ")}, ${bookingConfig.availableStart}–${bookingConfig.availableEnd} (slot: ${bookingConfig.slotDuration}min, min notice: ${bookingConfig.minNoticeHours}h). When the visitor suggests a time, verify it falls within these hours using book_appointment — the system will check availability.`
    : "";
  const parts = [
    agent.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    agent.description ? `About this business: ${agent.description}` : "",
    agent.instructions ? `Guidelines:\n${agent.instructions}` : "",
    agent.tools?.length
      ? `Available tools: ${agent.tools.join(", ")}`
      : "",
    `You are the assistant of the business on domain "${domain.slug}".`,
    "Appointments and payments are live: use book_appointment to schedule calls and create_payment (or sell_product) for purchases. Never create either without the visitor's agreement.",
    bookingLine,
    filterLine,
    catalogLine,
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** SSE delta stream constants. */
const DELTA_INTERVAL_MS = 1000;
const DELTA_MAX_WAIT_MS = 8000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * SSE delta stream: waits for new messages after `since` and pushes them,
 * then closes. Serverless-safe: each request holds at most ~8s; clients
 * reconnect immediately. No broker needed.
 */
function buildDeltaStream(
  listMessagesSince: (id: string, since: Date, sender?: "owner") => Promise<unknown[]>,
  conversationId: string,
  since: Date,
  senderFilter: "owner" | undefined,
) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (payload: unknown) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
        );

      const start = Date.now();
      try {
        for (;;) {
          if (Date.now() - start >= DELTA_MAX_WAIT_MS) {
            send({
              type: "done",
              conversationId,
              serverTime: new Date().toISOString(),
            });
            break;
          }
          const rows = await listMessagesSince(conversationId, since, senderFilter);
          if (rows.length > 0) {
            for (const message of rows) {
              send({ type: "message", message });
            }
            send({
              type: "done",
              conversationId,
              serverTime: new Date().toISOString(),
            });
            break;
          }
          await sleep(DELTA_INTERVAL_MS);
        }
      } catch (error) {
        console.error({ err: error }, "delta_stream_failed");
        send({ type: "error", code: "DELTA_ERROR", message: "Delta stream failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      ...CORS_HEADERS,
    },
  });
}

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
          (message) =>
            message.sender !== "owner" &&
            message.createdAt.getTime() > conversation.ownerSeenAt.getTime(),
        ).length;

        // Derive title from the first user message (truncated to 60 chars)
        const firstUserMsg = msgs.find((message) => message.role === "user");
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

    /** Total unread message count across all conversations for an owner. */
    getTotalUnreadCount: async (ownerId: string) => {
      const ownerConversations = db
        .select({ id: conversations.id })
        .from(conversations)
        .innerJoin(agents, eq(conversations.agentId, agents.id))
        .innerJoin(domains, eq(agents.domainId, domains.id))
        .where(eq(domains.ownerId, ownerId));

      const [row] = await db
        .select({
          total: sql<number>`coalesce(sum(case when ${messages.sender} <> 'owner' and ${messages.createdAt} > ${conversations.ownerSeenAt} then 1 else 0 end), 0)`,
        })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(inArray(conversations.id, ownerConversations));

      return row?.total ?? 0;
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

    /** Active products for a domain (used in system prompt + sell_product). */
    getProductCatalog: async (domainId: string) => {
      return db
        .select({
          name: products.name,
          priceCents: products.priceCents,
          currency: products.currency,
        })
        .from(products)
        .where(
          and(
            eq(products.domainId, domainId),
            eq(products.active, true),
          ),
        );
    },

    /** Booking settings for a domain (used in system prompt). */
    getBookingConfig: async (domainId: string) => {
      const [config] = await db
        .select()
        .from(bookingSettings)
        .where(eq(bookingSettings.domainId, domainId))
        .limit(1);
      return config ?? null;
    },

    /**
     * SSE delta stream: waits for new messages after `since` and pushes them.
     */
    streamDelta: (
      conversationId: string,
      since: Date,
      senderFilter: "owner" | undefined,
    ) => {
      return buildDeltaStream(
        (conversationId, since, sender) => requireConversation(conversationId).then(() =>
          db.select().from(messages)
            .where(and(
              eq(messages.conversationId, conversationId),
              gte(messages.createdAt, since),
              sender ? eq(messages.sender, sender) : sql`true`,
            ))
            .orderBy(messages.createdAt)
        ),
        conversationId,
        since,
        senderFilter,
      );
    },
  };
}

export type ChatService = ReturnType<typeof createChatService>;

// ---------------------------------------------------------------------------
// Handler functions — standalone, no self-reference issues.
// These are called by the Next.js route with the chatService instance.
// ---------------------------------------------------------------------------

type AiService = {
  isConfigured: boolean;
  streamChat: (opts: {
    systemPrompt: string;
    messages: { role: "user" | "assistant"; content: string }[];
    tools?: AgentToolName[];
    executeTool: (name: AgentToolName, args: Record<string, unknown>) => Promise<string>;
  }) => AsyncIterable<{ type: string; delta?: string; name?: AgentToolName }>;
};

type Logger = { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

/** POST /api/chat — streams AI response as SSE. */
export async function handleChatPost(
  chatService: ChatService,
  db: Database,
  request: Request,
  handlerDeps: {
    aiService: AiService;
    portalService: PortalService;
    knowledgeService: KnowledgeService;
    chatRateLimiter: { check: (key: string) => boolean };
    logger: Logger;
  },
) {
  const { aiService, portalService, knowledgeService, chatRateLimiter, logger } = handlerDeps;

  const secret = request.headers.get("x-embed-secret");
  if (!secret) return jsonError(401, "MISSING_SECRET", "Missing embed secret");

  let body: SendMessageInput;
  try {
    body = sendMessageSchema.parse(await request.json());
  } catch (error) {
    const details =
      error instanceof Error ? JSON.stringify(error, null, 1) : "Invalid body";
    return jsonError(400, "INVALID_BODY", details);
  }

  try {
    const domain = await chatService.resolveDomainBySecret(secret);
    const agent = await chatService.defaultAgentForDomain(domain.id);
    if (!agent) {
      return jsonError(
        404,
        "NO_AGENT",
        "This domain has no agent configured yet",
      );
    }

    const rateKey = `msg:${body.visitorId}`;
    if (!chatRateLimiter.check(rateKey)) {
      return jsonError(
        429,
        "RATE_LIMITED",
        "Too many messages, slow down a bit",
      );
    }

    let conversationId = body.conversationId;
    if (conversationId) {
      try {
        const conversation =
          await chatService.getConversationForDomain(conversationId, domain.id);
        conversationId = conversation.id;
      } catch (error) {
        if (error instanceof ConversationServiceError) {
          return jsonError(error.status, error.code, error.message);
        }
        throw error;
      }
    } else {
      const today =
        await chatService.countDomainConversationsToday(domain.id);
      try {
        const limits = getPlanLimits(domain.plan);
        if (today >= limits.conversationsPerDay) {
          throw new PlanLimitError(
            429,
            "CONVERSATION_LIMIT_EXCEEDED",
            `Your plan allows ${limits.conversationsPerDay} widget conversations per day`,
          );
        }
      } catch (error) {
        if (error instanceof PlanLimitError) {
          return jsonError(error.status, error.code, error.message);
        }
        throw error;
      }

      const conversation = await chatService.findOrCreateConversation({
        agentId: agent.id,
        visitorId: body.visitorId,
      });
      conversationId = conversation.id;
    }

    await chatService.appendMessage(conversationId, {
      role: "user",
      content: body.message,
    });

    if (!aiService.isConfigured) {
      logger.error({ domain: domain.slug }, "ai_not_configured");
      return jsonError(
        503,
        "AI_NOT_CONFIGURED",
        "AI is not configured for this deployment",
      );
    }

    const context = await chatService.contextMessages(conversationId);
    const catalog = await chatService.getProductCatalog(domain.id);
    const bookingConfig = await chatService.getBookingConfig(domain.id);

    const toolExecutor = createToolExecutor({
      db,
      domain,
      agentId: agent.id,
      conversationId,
      chatService,
      portalService,
      knowledgeService,
      logger,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (payload: unknown) =>
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );

        let fullReply = "";
        try {
          for await (const event of aiService.streamChat({
            systemPrompt: systemPromptFor(domain, agent, catalog, bookingConfig),
            messages: context,
            tools: agent.tools as AgentToolName[] | undefined,
            executeTool: toolExecutor,
          })) {
            if (event.type === "text") {
              fullReply += event.delta!;
              send(event);
            } else if (event.type === "tool" || event.type === "escalate") {
              send(event);
            }
          }

          await chatService.appendMessage(conversationId, {
            role: "assistant",
            content: fullReply,
            metadata: JSON.stringify({ streamed: true }),
          });

          send({
            type: "done",
            conversationId,
            serverTime: new Date().toISOString(),
          });
          logger.info({ conversationId, chars: fullReply.length }, "chat_completed");
        } catch (error) {
          logger.error({ err: error }, "chat_stream_failed");
          send({
            type: "error",
            code: "AI_ERROR",
            message:
              error instanceof Error ? error.message : "AI request failed",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        ...CORS_HEADERS,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "chat_request_failed");
    if (error instanceof ConversationServiceError) {
      return jsonError(error.status, error.code, error.message);
    }
    if (error instanceof PlanLimitError) {
      return jsonError(error.status, error.code, error.message);
    }
    return jsonError(500, "INTERNAL_ERROR", "Something went wrong");
  }
}

/** GET /api/chat config — returns domain + agent info (no conversationId). */
export async function handleChatConfig(
  chatService: ChatService,
  request: Request,
  handlerDeps: {
    logger: Logger;
  },
) {
  const { logger } = handlerDeps;
  const secret = request.headers.get("x-embed-secret");
  if (!secret) return jsonError(401, "MISSING_SECRET", "Missing embed secret");

  try {
    const domain = await chatService.resolveDomainBySecret(secret);
    const agent = await chatService.defaultAgentForDomain(domain.id);
    return Response.json(
      {
        domain: { slug: domain.slug },
        agent: agent
          ? {
              name: agent.name,
              description: agent.description,
            }
          : null,
      },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    if (error instanceof ConversationServiceError) {
      return jsonError(error.status, error.code, error.message);
    }
    logger.error({ err: error }, "chat_config_failed");
    return jsonError(500, "INTERNAL_ERROR", "Something went wrong");
  }
}

/** GET /api/chat history — message history or delta stream. */
export async function handleChatHistory(
  chatService: ChatService,
  request: Request,
  handlerDeps: {
    authService: { getSession: (headers: Headers) => Promise<{ user: { id: string } } | null> };
    logger: Logger;
  },
) {
  const { authService, logger } = handlerDeps;
  const secret = request.headers.get("x-embed-secret");
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");

  const sinceRaw = url.searchParams.get("since");
  const since = sinceRaw && !Number.isNaN(Date.parse(sinceRaw))
    ? new Date(sinceRaw)
    : null;

  try {
    let resolvedId: string;
    let conversation: { id: string; status: string };
    let senderFilter: "owner" | undefined;
    let mode: "visitor" | "owner";

    if (secret) {
      const domain = await chatService.resolveDomainBySecret(secret);
      conversation = await chatService.getConversationForDomain(
        conversationId!,
        domain.id,
      );
      resolvedId = conversation.id;
      mode = "visitor";
      senderFilter = "owner";
    } else {
      const session = await authService.getSession(request.headers);
      if (!session?.user) {
        return jsonError(401, "UNAUTHORIZED", "Sign in to view conversations");
      }
      conversation = await chatService.getConversationForOwner(
        conversationId!,
        session.user.id,
      );
      resolvedId = conversation.id;
      mode = "owner";
    }

    if (since) {
      if (url.searchParams.get("stream") === "1") {
        return chatService.streamDelta(resolvedId, since, senderFilter);
      }
      const messages = await chatService.listMessagesSince(
        resolvedId,
        since,
        senderFilter,
      );
      return Response.json(
        {
          conversationId: resolvedId,
          mode,
          conversation,
          serverTime: new Date().toISOString(),
          messages,
        },
        { headers: CORS_HEADERS },
      );
    }

    const messages = await chatService.listMessages(resolvedId);
    return Response.json(
      {
        conversationId: resolvedId,
        mode,
        conversation,
        serverTime: new Date().toISOString(),
        messages,
      },
      { headers: CORS_HEADERS },
    );
  } catch (error) {
    if (error instanceof ConversationServiceError) {
      return jsonError(error.status, error.code, error.message);
    }
    logger.error({ err: error }, "chat_history_failed");
    return jsonError(500, "INTERNAL_ERROR", "Something went wrong");
  }
}
