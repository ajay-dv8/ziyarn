import { and, eq } from "drizzle-orm";

import type { Database } from "@repo/database";
import { leads, products, domains, users } from "@repo/database/schema";
import type { AgentToolName } from "@repo/ai";
import { currencyCode, formatDecimal } from "@repo/money";
import {
  createBookingSchema,
  createPaymentRequestSchema,
} from "@repo/api/portal/schemas";
import { checkSlotAvailable } from "@repo/api/portal/availability";
import { PortalServiceError } from "@repo/api/portal";
import type { PortalService } from "@repo/api/portal/server";
import type { KnowledgeService } from "@repo/api/knowledge/server";
import type { ChatService } from "@repo/api/chat/server";
import { upsertCustomers } from "@repo/api/customers/server";
import { escalationNotificationTemplate } from "@repo/api/email/templates";
import { sendTransactional } from "@repo/api/email/server";

type ToolExecutorDeps = {
  db: Database;
  domain: { id: string; slug: string };
  agentId: string;
  conversationId: string;
  chatService: ChatService;
  portalService: PortalService;
  knowledgeService: KnowledgeService;
  logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
};

export function createToolExecutor(deps: ToolExecutorDeps) {
  const {
    db,
    domain,
    agentId,
    conversationId,
    chatService,
    portalService,
    knowledgeService,
    logger,
  } = deps;

  return async (
    name: AgentToolName,
    args: Record<string, unknown>,
  ): Promise<string> => {
    switch (name) {
      case "capture_email": {
        const email = typeof args.email === "string" ? args.email : "";
        const visitorName =
          typeof args.name === "string" ? args.name.trim().slice(0, 200) : "";
        const answers = Array.isArray(args.answers)
          ? args.answers
              .filter(
                (answerEntry): answerEntry is { question?: unknown; answer?: unknown } =>
                  typeof answerEntry === "object" && answerEntry !== null,
              )
              .map((answerEntry) => ({
                question:
                  typeof answerEntry.question === "string"
                    ? answerEntry.question.trim().slice(0, 300)
                    : "",
                answer:
                  typeof answerEntry.answer === "string"
                    ? answerEntry.answer.trim().slice(0, 1000)
                    : "",
              }))
              .filter((answerEntry) => answerEntry.question && answerEntry.answer)
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
                name: visitorName || existing.name,
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
              name: visitorName || null,
              email: email || null,
              interest:
                typeof args.purpose === "string" ? args.purpose : null,
              answers: merged.size > 0 ? [...merged.values()] : null,
            });
          }
          if (email) {
            await upsertCustomers(db, {
              domainId: domain.id,
              source: "chat",
              conversationId,
              rows: [{ email, name: visitorName || null }],
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
        const slotError = await checkSlotAvailable(db)(domain.id, parsed.data.date, parsed.data.time);
        if (slotError) {
          if (slotError.code === "SLOT_TAKEN") {
            return "That time slot is already booked. Offer the visitor a different date or time.";
          }
          if (slotError.code === "OUTSIDE_HOURS") {
            return `That time is outside business hours. ${slotError.message}. Offer a time within working hours.`;
          }
          if (slotError.code === "DAY_NOT_AVAILABLE") {
            return "Bookings are not available on that day. Offer a different day.";
          }
          if (slotError.code === "TOO_SOON") {
            return `That's too soon. ${slotError.message}. Offer a later time.`;
          }
          if (slotError.code === "TOO_FAR") {
            return `That's too far ahead. ${slotError.message}. Offer a closer date.`;
          }
          return "That time is not available. Offer a different date or time.";
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
        return `Payment request created for ${formatDecimal({ amountMinor: payment.amountMinor, currency: payment.currency })} ${currencyCode({ amountMinor: payment.amountMinor, currency: payment.currency })}${payment.description ? ` (${payment.description})` : ""}. Share this secure payment link with the visitor: ${url}`;
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
        const matchedProduct = catalog.find(
          (catalogItem) => catalogItem.name.toLowerCase() === productName.toLowerCase(),
        );
        if (!matchedProduct) {
          const names = catalog.map((catalogItem) => catalogItem.name).join(", ") ||
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
          productId: matchedProduct.id,
          amountMinor: matchedProduct.priceCents * quantity,
          currency: matchedProduct.currency,
          description:
            quantity > 1
              ? `${matchedProduct.name} x${quantity}`
              : matchedProduct.name,
        });
        if (!parsed.success) {
          return `The payment could not be created (${parsed.error.issues[0]?.message ?? "bad input"}). Try again.`;
        }
        const { payment, url } = await portalService.createPaymentRequest(parsed.data);
        logger.info(
          { paymentId: payment.id, productId: matchedProduct.id },
          "catalog_product_sold",
        );
        return `Payment request created for ${matchedProduct.name} (${formatDecimal({ amountMinor: payment.amountMinor, currency: payment.currency })} ${currencyCode({ amountMinor: payment.amountMinor, currency: payment.currency })})${quantity > 1 ? ` x${quantity}` : ""}. Share this secure payment link with the visitor: ${url}`;
      }
      case "escalate":
        await chatService.setConversationStatus(conversationId, "escalated");
        logger.info({ conversationId }, "conversation_escalated");
        // Best-effort email notification to domain owner
        try {
          const [domainRow] = await db
            .select({ ownerId: domains.ownerId, domainName: domains.name })
            .from(domains)
            .where(eq(domains.id, domain.id))
            .limit(1);
          if (domainRow) {
            const [ownerRow] = await db
              .select({ email: users.email })
              .from(users)
              .where(eq(users.id, domainRow.ownerId))
              .limit(1);
            if (ownerRow?.email) {
              const firstMsg = await chatService.contextMessages(conversationId, 1);
              const dashboardUrl = `${process.env.BETTER_AUTH_URL ?? ""}/dashboard/conversations?conversationId=${conversationId}`;
              const template = escalationNotificationTemplate({
                domainName: domainRow.domainName,
                dashboardUrl,
                conversationId,
                firstMessage: firstMsg[0]?.content ?? null,
              });
              await sendTransactional({
                to: ownerRow.email,
                subject: template.subject,
                text: template.text,
                html: template.html,
              });
            }
          }
        } catch (emailError) {
          logger.error({ err: emailError, conversationId }, "escalation_email_failed");
        }
        return "The visitor has been connected to a human agent.";
      case "answer_knowledge": {
        const query =
          typeof args.query === "string" ? args.query.trim().slice(0, 1000) : "";
        if (!query) {
          return "No question was provided. Ask the visitor what they would like to know.";
        }
        const hits = await knowledgeService.queryKnowledge({
          agentId,
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
}
