import { and, eq } from "drizzle-orm";

import type Stripe from "stripe";

import type { Database } from "@repo/database";
import {
  domains,
  stripeAccounts,
  subscriptions,
  type Subscription,
} from "@repo/database/schema";

import type { BillingPlan, CheckoutPlan } from "@repo/api/billing/schemas";

export class BillingServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BillingServiceError";
  }
}

function billingNotConfiguredError() {
  return new BillingServiceError(
    501,
    "BILLING_NOT_CONFIGURED",
    "Billing is not configured for this deployment",
  );
}

function priceIdForPlan(plan: CheckoutPlan): string | null {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}`;
  return process.env[key] ?? null;
}

export type BillingService = ReturnType<typeof createBillingService>;

export function createBillingService(deps: { db: Database }) {
  const { db } = deps;

  return {
    /** Returns the owner's current subscription (if any). */
    async getSubscription(ownerId: string): Promise<Subscription | null> {
      const [row] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.ownerId, ownerId))
        .limit(1);
      return row ?? null;
    },

    /**
     * Creates a Stripe Checkout session for a plan upgrade. Without Stripe
     * keys the session cannot be created (graceful degradation, same as P5).
     */
    async createCheckoutSession(
      ownerId: string,
      input: { plan: CheckoutPlan; email: string },
    ): Promise<{ url: string }> {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) {
        throw billingNotConfiguredError();
      }
      const priceId = priceIdForPlan(input.plan);
      if (!priceId) {
        throw new BillingServiceError(
          501,
          "PRICE_NOT_CONFIGURED",
          `No Stripe price configured for the ${input.plan} plan`,
        );
      }
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(secretKey);

      const existing = await this.getSubscription(ownerId);
      const customerId = existing?.stripeCustomerId ?? undefined;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        customer_email: customerId ? undefined : input.email,
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          metadata: { ownerId, plan: input.plan },
        },
        metadata: { ownerId, plan: input.plan },
        success_url: `${process.env.BASE_APP_URL ?? "http://localhost:3000"}/dashboard/billing?upgraded=1`,
        cancel_url: `${process.env.BASE_APP_URL ?? "http://localhost:3000"}/dashboard/billing`,
        allow_promotion_codes: true,
      });
      return { url: session.url ?? "/dashboard/billing" };
    },

    /** Creates a Stripe billing portal session so owners can cancel/downgrade. */
    async createPortalSession(ownerId: string): Promise<{ url: string }> {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) {
        throw billingNotConfiguredError();
      }
      const subscription = await this.getSubscription(ownerId);
      if (!subscription?.stripeCustomerId) {
        throw new BillingServiceError(
          404,
          "NO_SUBSCRIPTION",
          "You do not have a subscription yet",
        );
      }
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(secretKey);
      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${process.env.BASE_APP_URL ?? "http://localhost:3000"}/dashboard/billing`,
      });
      return { url: session.url };
    },

    /**
     * Handles Stripe subscription events (checkout.session.completed,
     * customer.subscription.updated/deleted). On activation the owner's plan
     * is applied to every domain atomically; on cancel/delete it reverts to
     * free.
     */
    async handleStripeWebhook(rawBody: string, signature: string): Promise<{ handled: boolean }> {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!webhookSecret || !secretKey) {
        throw billingNotConfiguredError();
      }
      const { default: StripeClient } = await import("stripe");
      const stripe = new StripeClient(secretKey);
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
      } catch {
        throw new BillingServiceError(
          400,
          "STRIPE_SIGNATURE_INVALID",
          "Invalid webhook signature",
        );
      }

      const subscription = (event.data.object as {
        id?: string;
        customer?: string;
        status?: string;
        metadata?: Record<string, string>;
        current_period_end?: number;
      });

      const planOf = (metadata: Record<string, string> | undefined): Exclude<BillingPlan, "free"> | null => {
        const value = metadata?.plan;
        if (value === "standard" || value === "pro" || value === "ultimate") {
          return value;
        }
        return null;
      };

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as {
            subscription?: string;
            customer?: string;
            metadata?: Record<string, string>;
          };
          const ownerId = session.metadata?.ownerId;
          const plan = planOf(session.metadata);
          if (!ownerId || !plan || !session.subscription || !session.customer) {
            return { handled: false };
          }
          await this.upsertSubscription(ownerId, {
            plan,
            status: "active",
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          });
          return { handled: true };
        }
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const id = subscription.id;
          const status = subscription.status;
          if (!id || !status) {
            return { handled: false };
          }
          const current = await this.getSubscriptionByStripeId(id);
          if (!current) {
            return { handled: false };
          }
          const cancelled = status === "canceled" || status === "incomplete_expired";
          const domainPlan: BillingPlan = cancelled
            ? "free"
            : (planOf(subscription.metadata ?? {}) ?? current.plan);
          const subscriptionPlan = cancelled
            ? current.plan
            : (planOf(subscription.metadata ?? {}) ?? current.plan);
          const newStatus = cancelled
            ? "canceled"
            : (status === "active" || status === "trialing"
              ? status
              : "past_due");
          await db.transaction(async (tx) => {
            await tx
              .update(subscriptions)
              .set({
                plan: subscriptionPlan,
                status: newStatus,
                stripeCustomerId: subscription.customer ?? current.stripeCustomerId,
                currentPeriodEnd: subscription.current_period_end
                  ? new Date(subscription.current_period_end * 1000)
                  : undefined,
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.id, current.id));
            await tx
              .update(domains)
              .set({ plan: domainPlan, updatedAt: new Date() })
              .where(eq(domains.ownerId, current.ownerId));
          });
          return { handled: true };
        }
        case "account.updated": {
          const account = event.data.object as {
            id?: string;
            details_submitted?: boolean;
          };
          if (!account.id) {
            return { handled: false };
          }
          const [row] = await db
            .select()
            .from(stripeAccounts)
            .where(eq(stripeAccounts.stripeAccountId, account.id))
            .limit(1);
          if (!row) {
            return { handled: false };
          }
          await db
            .update(stripeAccounts)
            .set({
              status: account.details_submitted ? "complete" : "onboarding",
              updatedAt: new Date(),
            })
            .where(eq(stripeAccounts.id, row.id));
          return { handled: true };
        }
        default:
          return { handled: false };
      }
    },

    async upsertSubscription(
      ownerId: string,
      input: {
        plan: Exclude<BillingPlan, "free">;
        status: Subscription["status"];
        stripeCustomerId: string;
        stripeSubscriptionId: string;
        currentPeriodEnd?: Date;
      },
    ): Promise<void> {
      const existing = await this.getSubscription(ownerId);
      if (!existing) {
        await db.insert(subscriptions).values({
          ownerId,
          ...input,
          currentPeriodEnd: input.currentPeriodEnd ?? null,
        });
        return;
      }
      await db
        .update(subscriptions)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(subscriptions.id, existing.id));
    },

    async getSubscriptionByStripeId(
      stripeSubscriptionId: string,
    ): Promise<Subscription | null> {
      const [row] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
        .limit(1);
      return row ?? null;
    },

    /** Applies a plan to every domain of an owner (used on activation). */
    async applyPlanToDomains(ownerId: string, plan: BillingPlan): Promise<void> {
      await db
        .update(domains)
        .set({ plan, updatedAt: new Date() })
        .where(and(eq(domains.ownerId, ownerId)));
    },
  };
}
