import { createHmac, timingSafeEqual } from "node:crypto";

import type Stripe from "stripe";

import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  bookings,
  domains,
  payments,
  leads,
  stripeAccounts,
  type Booking,
  type Payment,
} from "@repo/database/schema";

import {
  confirmBookingSchema,
  createBookingSchema,
  createPaymentRequestSchema,
  portalTokenSchema,
  type CreateBookingInput,
  type CreatePaymentRequestInput,
  type PortalTokenPayload,
} from "@repo/api/portal/schemas";

export class PortalServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PortalServiceError";
  }
}

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseDomainUrl(): string {
  return (
    process.env.BASE_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  );
}

function connectedAccountError() {
  return new PortalServiceError(
    409,
    "CONNECTED_ACCOUNT_REQUIRED",
    "The domain owner has no connected Stripe account yet",
  );
}

function paymentsNotConfiguredError() {
  return new PortalServiceError(
    501,
    "PAYMENTS_NOT_CONFIGURED",
    "Payments are not configured for this deployment",
  );
}

export type PortalContext = {
  booking: Booking & { domainName: string };
  payment: Payment & { domainName: string };
};

export function createPortalService(deps: { db: Database }) {
  const { db } = deps;
  const secret: string = (() => {
    const value = process.env.PORTAL_URL_SECRET ?? process.env.BETTER_AUTH_SECRET;
    if (!value) {
      throw new Error("PORTAL_URL_SECRET or BETTER_AUTH_SECRET must be set");
    }
    return value;
  })();

  function signToken(payload: Omit<PortalTokenPayload, "exp">): string {
    const body: PortalTokenPayload = {
      ...payload,
      exp: Date.now() + TOKEN_TTL_MS,
    };
    const encoded = base64UrlEncode(JSON.stringify(body));
    const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
    return `${encoded}.${signature}`;
  }

  function verifyToken(token: string): PortalTokenPayload {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) {
      throw new PortalServiceError(401, "INVALID_PORTAL_TOKEN", "Invalid portal link");
    }
    const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
    if (!safeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new PortalServiceError(401, "INVALID_PORTAL_TOKEN", "Invalid portal link");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(base64UrlDecode(encoded));
    } catch {
      throw new PortalServiceError(401, "INVALID_PORTAL_TOKEN", "Invalid portal link");
    }
    const result = portalTokenSchema.safeParse(parsed);
    if (!result.success) {
      throw new PortalServiceError(401, "INVALID_PORTAL_TOKEN", "Invalid portal link");
    }
    if (result.data.exp < Date.now()) {
      throw new PortalServiceError(410, "PORTAL_TOKEN_EXPIRED", "This link has expired");
    }
    return result.data;
  }

  const bookingUrl = (token: string) =>
    `${parseDomainUrl()}/portal/booking?t=${encodeURIComponent(token)}`;
  const paymentUrl = (token: string) =>
    `${parseDomainUrl()}/portal/pay?t=${encodeURIComponent(token)}`;

  return {
    signToken,
    verifyToken,

    async createBooking(input: CreateBookingInput): Promise<{
      booking: Booking;
      token: string;
      url: string;
    }> {
      const data = createBookingSchema.parse(input);
      const taken = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.domainId, data.domainId),
            eq(bookings.date, data.date),
            eq(bookings.time, data.time),
            inArray(bookings.status, ["pending", "confirmed"]),
          ),
        )
        .limit(1);
      if (taken.length > 0) {
        throw new PortalServiceError(
          409,
          "SLOT_UNAVAILABLE",
          "That time slot is already booked",
        );
      }
      const [booking] = await db
        .insert(bookings)
        .values({
          domainId: data.domainId,
          conversationId: data.conversationId ?? null,
          name: data.name ?? null,
          email: data.email ?? null,
          date: data.date,
          time: data.time,
          topic: data.topic ?? null,
        })
        .returning();
      if (!booking) {
        throw new PortalServiceError(500, "CREATE_FAILED", "Failed to create booking");
      }
      const token = signToken({ type: "booking", id: booking.id, domainId: booking.domainId });
      return { booking, token, url: bookingUrl(token) };
    },

    async confirmBooking(token: string): Promise<Booking> {
      confirmBookingSchema.parse({ token });
      const payload = verifyToken(token);
      if (payload.type !== "booking") {
        throw new PortalServiceError(400, "WRONG_TOKEN_TYPE", "This link is not a booking link");
      }
      const [booking] = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.id, payload.id), eq(bookings.domainId, payload.domainId)))
        .limit(1);
      if (!booking) {
        throw new PortalServiceError(404, "NOT_FOUND", "Booking not found");
      }
      if (booking.status === "cancelled") {
        throw new PortalServiceError(409, "BOOKING_CANCELLED", "This booking was cancelled");
      }
      if (booking.status === "confirmed") {
        return booking;
      }
      const [updated] = await db
        .update(bookings)
        .set({ status: "confirmed", updatedAt: new Date() })
        .where(eq(bookings.id, booking.id))
        .returning();
      if (!updated) {
        throw new PortalServiceError(500, "UPDATE_FAILED", "Failed to confirm booking");
      }
      return updated;
    },

    async getBookingByToken(token: string): Promise<{
      booking: Booking;
      domainName: string;
    }> {
      const payload = verifyToken(token);
      if (payload.type !== "booking") {
        throw new PortalServiceError(400, "WRONG_TOKEN_TYPE", "This link is not a booking link");
      }
      const [row] = await db
        .select({ booking: bookings, domainName: domains.name })
        .from(bookings)
        .innerJoin(domains, eq(domains.id, bookings.domainId))
        .where(and(eq(bookings.id, payload.id), eq(bookings.domainId, payload.domainId)))
        .limit(1);
      if (!row) {
        throw new PortalServiceError(404, "NOT_FOUND", "Booking not found");
      }
      return row;
    },

    async createPaymentRequest(input: CreatePaymentRequestInput): Promise<{
      payment: Payment;
      token: string;
      url: string;
    }> {
      const data = createPaymentRequestSchema.parse(input);
      const [payment] = await db
        .insert(payments)
        .values({
          domainId: data.domainId,
          conversationId: data.conversationId ?? null,
          bookingId: data.bookingId ?? null,
          email: data.email ?? null,
          description: data.description ?? null,
          amountMinor: data.amountMinor,
          currency: data.currency,
        })
        .returning();
      if (!payment) {
        throw new PortalServiceError(500, "CREATE_FAILED", "Failed to create payment request");
      }
      const token = signToken({ type: "payment", id: payment.id, domainId: payment.domainId });
      return { payment, token, url: paymentUrl(token) };
    },

    async getPaymentByToken(token: string): Promise<{
      payment: Payment;
      domainName: string;
    }> {
      const payload = verifyToken(token);
      if (payload.type !== "payment") {
        throw new PortalServiceError(400, "WRONG_TOKEN_TYPE", "This link is not a payment link");
      }
      const [row] = await db
        .select({ payment: payments, domainName: domains.name })
        .from(payments)
        .innerJoin(domains, eq(domains.id, payments.domainId))
        .where(and(eq(payments.id, payload.id), eq(payments.domainId, payload.domainId)))
        .limit(1);
      if (!row) {
        throw new PortalServiceError(404, "NOT_FOUND", "Payment not found");
      }
      return row;
    },

    async createPaymentIntent(token: string): Promise<{
      clientSecret: string;
      publishableKey: string;
    }> {
      const payload = verifyToken(token);
      if (payload.type !== "payment") {
        throw new PortalServiceError(400, "WRONG_TOKEN_TYPE", "This link is not a payment link");
      }
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
      if (!stripeSecretKey || !publishableKey) {
        throw paymentsNotConfiguredError();
      }
      const [row] = await db
        .select({ payment: payments, domain: domains })
        .from(payments)
        .innerJoin(domains, eq(domains.id, payments.domainId))
        .where(and(eq(payments.id, payload.id), eq(payments.domainId, payload.domainId)))
        .limit(1);
      if (!row) {
        throw new PortalServiceError(404, "NOT_FOUND", "Payment not found");
      }
      if (row.payment.status === "paid") {
        throw new PortalServiceError(409, "PAYMENT_ALREADY_PAID", "This payment was already completed");
      }
      const [account] = await db
        .select()
        .from(stripeAccounts)
        .where(
          and(
            eq(stripeAccounts.ownerId, row.domain.ownerId),
            eq(stripeAccounts.status, "complete"),
          ),
        )
        .limit(1);
      if (!account) {
        throw connectedAccountError();
      }
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(stripeSecretKey);
      const applicationFeeBps = Number(process.env.STRIPE_APP_FEE_BASIS_POINTS ?? 0);
      const intent = await stripe.paymentIntents.create(
        {
          amount: row.payment.amountMinor,
          currency: row.payment.currency.toLowerCase(),
          description: row.payment.description ?? undefined,
          metadata: {
            paymentId: row.payment.id,
            bookingId: row.payment.bookingId ?? "",
            domainId: row.payment.domainId,
          },
          ...(applicationFeeBps > 0 ? { application_fee_amount: Math.floor(row.payment.amountMinor * applicationFeeBps / 10000) } : {}),
          automatic_payment_methods: { enabled: true },
        },
        { stripeAccount: account.stripeAccountId },
      );
      if (!intent.client_secret) {
        throw new PortalServiceError(500, "STRIPE_INTENT_FAILED", "Stripe returned no client secret");
      }
      await db
        .update(payments)
        .set({
          status: "requires_payment",
          stripePaymentIntentId: intent.id,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, row.payment.id));
      return { clientSecret: intent.client_secret, publishableKey };
    },

    async handleStripeWebhook(rawBody: string, signature: string): Promise<{ handled: boolean }> {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw paymentsNotConfiguredError();
      }
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch {
        throw new PortalServiceError(400, "STRIPE_SIGNATURE_INVALID", "Invalid webhook signature");
      }
      if (event.type !== "payment_intent.succeeded") {
        return { handled: false };
      }
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentId = intent.metadata?.paymentId;
      if (!paymentId) {
        return { handled: false };
      }
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);
      if (!payment || payment.status === "paid") {
        return { handled: false };
      }
      await db.transaction(async (tx) => {
        await tx
          .update(payments)
          .set({ status: "paid", updatedAt: new Date() })
          .where(eq(payments.id, payment.id));
        if (payment.bookingId) {
          await tx
            .update(bookings)
            .set({ status: "confirmed", updatedAt: new Date() })
            .where(eq(bookings.id, payment.bookingId));
        }
        if (payment.email) {
          const existing = await tx
            .select({ id: leads.id })
            .from(leads)
            .where(eq(leads.email, payment.email))
            .limit(1);
          if (existing.length === 0) {
            await tx.insert(leads).values({
              conversationId: payment.conversationId,
              email: payment.email,
              interest: payment.description,
            });
          }
        }
      });
      return { handled: true };
    },
  };
}

export type PortalService = ReturnType<typeof createPortalService>;
