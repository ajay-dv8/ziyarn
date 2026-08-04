import { getPlanLimits, PlanLimitError } from "@repo/api/plans";
import {
  ConversationServiceError,
  sendMessageSchema,
} from "@repo/api/chat";
import { db } from "@repo/database";
import { leads } from "@repo/database/schema";
import type { AgentToolName } from "@repo/ai";

import { aiService, chatService, logger } from "@/lib/chat-service";
import { chatRateLimiter } from "@/lib/rate-limit";

const DEFAULT_SYSTEM_PROMPT = `You are a friendly sales and support assistant for this business.
Help visitors with their questions, qualify their interest, and move them toward booking a call or buying.
Be concise, honest and helpful. Never invent company facts you are unsure about.
If a visitor asks for a human, is frustrated, or the request is out of scope, escalate to a human agent.`;

export const runtime = "nodejs";

function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

function systemPromptFor(domain: { slug: string }, agent: {
  name: string | null;
  description: string | null;
  instructions: string | null;
  systemPrompt: string | null;
  tools: string[] | null;
}): string {
  const parts = [
    agent.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    agent.description ? `About this business: ${agent.description}` : "",
    agent.instructions ? `Guidelines:\n${agent.instructions}` : "",
    agent.tools?.length
      ? `Available tools: ${agent.tools.join(", ")}`
      : "",
    `You are the assistant of the business on domain "${domain.slug}".`,
    "Booking and payments are not available yet: tell visitors a human will follow up, and only escalate when they insist or ask for a human.",
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
    const toolExecutor = async (
      name: AgentToolName,
      args: Record<string, unknown>,
    ): Promise<string> => {
      switch (name) {
        case "capture_email": {
          const email = typeof args.email === "string" ? args.email : "";
          if (email) {
            await db.insert(leads).values({
              conversationId,
              email,
              interest:
                typeof args.purpose === "string" ? args.purpose : null,
            });
            logger.info({ conversationId, email }, "lead_captured");
          }
          return email
            ? `Email ${email} captured for follow-up.`
            : "No email was provided.";
        }
        case "book_appointment":
          return "Appointment booking is not available yet. Tell the visitor a human will follow up to schedule, and escalate if they insist.";
        case "create_payment":
          return "Payments are not available yet. Tell the visitor a payment link will be sent by email.";
        case "escalate":
          await chatService.setConversationStatus(conversationId, "escalated");
          logger.info({ conversationId }, "conversation_escalated");
          return "The visitor has been connected to a human agent.";
        case "answer_knowledge":
          return "No knowledge base entry found for this question. Answer generally or offer to escalate.";
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
            systemPrompt: systemPromptFor(domain, agent),
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

          send({ type: "done", conversationId });
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

/** Message history for a conversation, authenticated by embed secret. */
export async function GET(request: Request) {
  const secret = request.headers.get("x-embed-secret");
  if (!secret) return jsonError(401, "MISSING_SECRET", "Missing embed secret");

  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) {
    return jsonError(400, "MISSING_CONVERSATION", "conversationId is required");
  }

  try {
    const domain = await chatService.resolveDomainBySecret(secret);
    const conversation = await chatService.getConversationForDomain(
      conversationId,
      domain.id,
    );
    const messages = await chatService.listMessages(conversation.id);
    return Response.json({ conversation, messages });
  } catch (error) {
    if (error instanceof ConversationServiceError) {
      return jsonError(error.status, error.code, error.message);
    }
    logger.error({ err: error }, "chat_history_failed");
    return jsonError(500, "INTERNAL_ERROR", "Something went wrong");
  }
}
