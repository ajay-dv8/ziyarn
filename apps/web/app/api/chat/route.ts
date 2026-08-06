import { and, eq } from "drizzle-orm";
import { getPlanLimits, PlanLimitError } from "@repo/api/plans";
import {
  ConversationServiceError,
  sendMessageSchema,
} from "@repo/api/chat";
import { PortalServiceError } from "@repo/api/portal";
import {
  createBookingSchema,
  createPaymentRequestSchema,
} from "@repo/api/portal/schemas";
import { db } from "@repo/database";
import { leads, products } from "@repo/database/schema";
import type { AgentToolName } from "@repo/ai";

import { aiService, chatService, logger } from "@/services/chat-service";
import { authService } from "@/services/auth-service";
import { knowledgeService } from "@/services/knowledge-service";
import { portalService } from "@/services/portal-service";
import { chatRateLimiter } from "@/lib/rate-limit";

const DEFAULT_SYSTEM_PROMPT = `You are a friendly sales and support assistant for this business.
Help visitors with their questions, qualify their interest, and move them toward booking a call or buying.
Be concise, honest and helpful. Never invent company facts you are unsure about.
If a visitor asks for a human, is frustrated, or the request is out of scope, escalate to a human agent.`;

export const runtime = "nodejs";

/** The widget runs inside arbitrary host pages, so the public API must be cross-origin friendly. */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-embed-secret",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: CORS_HEADERS });
}

function systemPromptFor(domain: { slug: string }, agent: {
  name: string | null;
  description: string | null;
  instructions: string | null;
  systemPrompt: string | null;
  tools: string[] | null;
  filterQuestions: unknown;
}, catalog: { name: string; priceCents: number; currency: string }[]): string {
  const filterQuestions = Array.isArray(agent.filterQuestions)
    ? agent.filterQuestions.filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    : [];
  const catalogLine = catalog.length > 0
    ? `Product catalog (sell ONLY from this list, using sell_product; never invent prices):\n${catalog
        .map((p) => `- ${p.name} — ${(p.priceCents / 100).toFixed(2)} ${p.currency.toUpperCase()}`)
        .join("\n")}`
    : "There are no products in the catalog yet. Direct purchase interest to create_payment for a custom amount, or offer to escalate.";
  const filterLine = filterQuestions.length > 0
    ? `Before capturing an email or offering to sell, ask these filter questions one at a time (do not dump them all at once):\n${filterQuestions.map((q) => `- ${q}`).join("\n")}\nWhen the visitor has answered, call capture_email and include the answers in its answers argument.`
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
    filterLine,
    catalogLine,
  ];
  return parts.filter(Boolean).join("\n\n");
}

/**
 * Public chat API consumed by the widget (and any client). Authenticated with
 * the domain embed secret header; streams assistant replies over SSE.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-embed-secret");
  if (!secret) return jsonError(401, "MISSING_SECRET", "Missing embed secret");

  let body: ReturnType<typeof sendMessageSchema.parse>;
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
    const catalog = await db
      .select({
        name: products.name,
        priceCents: products.priceCents,
        currency: products.currency,
      })
      .from(products)
      .where(
        and(
          eq(products.domainId, domain.id),
          eq(products.active, true),
        ),
      );
    const toolExecutor = async (
      name: AgentToolName,
      args: Record<string, unknown>,
    ): Promise<string> => {
      switch (name) {
        case "capture_email": {
          const email = typeof args.email === "string" ? args.email : "";
          const answers = Array.isArray(args.answers)
            ? args.answers
                .filter(
                  (a): a is { question?: unknown; answer?: unknown } =>
                    typeof a === "object" && a !== null,
                )
                .map((a) => ({
                  question:
                    typeof a.question === "string"
                      ? a.question.trim().slice(0, 300)
                      : "",
                  answer:
                    typeof a.answer === "string"
                      ? a.answer.trim().slice(0, 1000)
                      : "",
                }))
                .filter((a) => a.question && a.answer)
            : [];
          if (email || answers.length > 0) {
            const [existing] = await db
              .select()
              .from(leads)
              .where(eq(leads.conversationId, conversationId))
              .limit(1);
            const merged = new Map<string, { question: string; answer: string }>();
            for (const prior of Array.isArray(existing?.answers)
              ? (existing.answers as { question: string; answer: string }[])
              : []) {
              merged.set(prior.question, prior);
            }
            for (const answer of answers) {
              merged.set(answer.question, answer);
            }
            if (existing) {
              await db
                .update(leads)
                .set({
                  email: email || existing.email,
                  interest:
                    typeof args.purpose === "string"
                      ? args.purpose
                      : existing.interest,
                  answers: merged.size > 0 ? [...merged.values()] : null,
                })
                .where(eq(leads.id, existing.id));
            } else {
              await db.insert(leads).values({
                conversationId,
                email: email || null,
                interest:
                  typeof args.purpose === "string" ? args.purpose : null,
                answers: merged.size > 0 ? [...merged.values()] : null,
              });
            }
            logger.info({ conversationId, email }, "lead_captured");
          }
          return email
            ? `Email ${email} captured for follow-up.`
            : "No email was provided.";
        }
        case "book_appointment": {
          const parsed = createBookingSchema.safeParse({
            domainId: domain.id,
            conversationId,
            date: args.date,
            time: args.time,
            topic: typeof args.topic === "string" ? args.topic : undefined,
            email: typeof args.email === "string" ? args.email : undefined,
          });
          if (!parsed.success) {
            return `The appointment details were invalid (${parsed.error.issues[0]?.message ?? "bad input"}). Ask the visitor for a preferred date and time again.`;
          }
          try {
            const { booking, url } = await portalService.createBooking(parsed.data);
            logger.info({ bookingId: booking.id }, "appointment_requested");
            return `Appointment request created for ${booking.date} at ${booking.time}. Ask the visitor to confirm by opening this link: ${url}`;
          } catch (error) {
            if (error instanceof PortalServiceError && error.code === "SLOT_UNAVAILABLE") {
              return "That time slot is already booked. Offer the visitor a different date or time.";
            }
            throw error;
          }
        }
        case "create_payment": {
          const amount =
            typeof args.amount === "number" && Number.isFinite(args.amount) && args.amount > 0
              ? Math.round(args.amount * 100)
              : 0;
          const parsed = createPaymentRequestSchema.safeParse({
            domainId: domain.id,
            conversationId,
            amountMinor: amount,
            currency: args.currency,
            description:
              typeof args.description === "string" ? args.description : undefined,
          });
          if (!parsed.success) {
            return `The payment details were invalid (${parsed.error.issues[0]?.message ?? "bad input"}). Ask the visitor to confirm the amount and currency again.`;
          }
          const { payment, url } = await portalService.createPaymentRequest(parsed.data);
          logger.info({ paymentId: payment.id }, "payment_requested");
          return `Payment request created for ${(payment.amountMinor / 100).toFixed(2)} ${payment.currency}${payment.description ? ` (${payment.description})` : ""}. Share this secure payment link with the visitor: ${url}`;
        }
        case "sell_product": {
          const productName =
            typeof args.product === "string" ? args.product.trim() : "";
          if (!productName) {
            return "No product name was provided. Ask the visitor which catalog product they want, then call sell_product with its exact name.";
          }
          const catalog = await db
            .select()
            .from(products)
            .where(
              and(
                eq(products.domainId, domain.id),
                eq(products.active, true),
              ),
            );
          const product = catalog.find(
            (p) => p.name.toLowerCase() === productName.toLowerCase(),
          );
          if (!product) {
            const names = catalog.map((p) => p.name).join(", ") ||
              "no products configured";
            return `"${productName}" is not in this business's catalog. Available catalog products: ${names}. Ask the visitor to pick one of those, or use create_payment for a custom amount.`;
          }
          const quantity =
            typeof args.quantity === "number" &&
            Number.isFinite(args.quantity) &&
            args.quantity >= 1 &&
            args.quantity <= 100
              ? Math.floor(args.quantity)
              : 1;
          const parsed = createPaymentRequestSchema.safeParse({
            domainId: domain.id,
            conversationId,
            productId: product.id,
            amountMinor: product.priceCents * quantity,
            currency: product.currency,
            description:
              quantity > 1
                ? `${product.name} x${quantity}`
                : product.name,
          });
          if (!parsed.success) {
            return `The payment could not be created (${parsed.error.issues[0]?.message ?? "bad input"}). Try again.`;
          }
          const { payment, url } = await portalService.createPaymentRequest(parsed.data);
          logger.info(
            { paymentId: payment.id, productId: product.id },
            "catalog_product_sold",
          );
          return `Payment request created for ${product.name} (${(payment.amountMinor / 100).toFixed(2)} ${payment.currency})${quantity > 1 ? ` x${quantity}` : ""}. Share this secure payment link with the visitor: ${url}`;
        }
        case "escalate":
          await chatService.setConversationStatus(conversationId, "escalated");
          logger.info({ conversationId }, "conversation_escalated");
          return "The visitor has been connected to a human agent.";
        case "answer_knowledge": {
          const query =
            typeof args.query === "string" ? args.query.trim().slice(0, 1000) : "";
          if (!query) {
            return "No question was provided. Ask the visitor what they would like to know.";
          }
          const hits = await knowledgeService.queryKnowledge({
            agentId: agent.id,
            query,
            limit: 5,
          });
          if (hits.length === 0) {
            return "No knowledge base entry found for this question. Answer generally or offer to escalate.";
          }
          return (
            "Relevant knowledge base entries:\n" +
            hits
              .map((hit, index) => `[${index + 1}] ${hit.text}`)
              .join("\n")
          );
        }
      }
    };

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
            systemPrompt: systemPromptFor(domain, agent, catalog),
            messages: context,
            tools: agent.tools as AgentToolName[] | undefined,
            executeTool: toolExecutor,
          })) {
            if (event.type === "text") {
              fullReply += event.delta;
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

/** Message history (conversationId) or widget config (no conversationId), authenticated by embed secret. */
export async function GET(request: Request) {
  const secret = request.headers.get("x-embed-secret");
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");

  if (!conversationId) {
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
        conversationId,
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
        conversationId,
        session.user.id,
      );
      resolvedId = conversation.id;
      mode = "owner";
    }

    if (since) {
      if (url.searchParams.get("stream") === "1") {
        return streamDelta(resolvedId, since, senderFilter);
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

const DELTA_INTERVAL_MS = 1000;
const DELTA_MAX_WAIT_MS = 8000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * SSE delta stream: waits (server-side Postgres poll) for new messages after
 * `since` and pushes them, then closes. Serverless-safe: each request holds at
 * most ~8s; clients reconnect immediately. No broker needed.
 */
function streamDelta(
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
          const rows = await chatService.listMessagesSince(
            conversationId,
            since,
            senderFilter,
          );
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
        logger.error({ err: error }, "delta_stream_failed");
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
