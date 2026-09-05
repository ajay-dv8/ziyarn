import { createHmac, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import type { Database } from "@repo/database";
import { subscriptions, type Subscription } from "@repo/database/schema";

import type { BillingService } from "@repo/api/billing/server";
import type { CheckoutPlan } from "@repo/api/billing/schemas";

export class PaystackServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PaystackServiceError";
  }
}

function paystackNotConfiguredError() {
  return new PaystackServiceError(
    501,
    "PAYSTACK_NOT_CONFIGURED",
    "Paystack is not configured for this deployment",
  );
}

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_TIMEOUT_MS = 20_000;

const PLAN_NAME: Record<CheckoutPlan, string> = {
  standard: "Ziyarn Plus",
  pro: "Ziyarn Business",
  ultimate: "Ziyarn Enterprise",
};

/**
 * Plan prices in Paystack minor units (pesewas for GHS, kobo for NGN). Env
 * overrides use the same minor units, e.g. PAYSTACK_PRICE_PRO=9900000.
 */
export const PLAN_PRICES_KOBO: Record<CheckoutPlan, number> = {
  standard: 5_900,
  pro: 10_500,
  ultimate: 25_000,
};

/** The currency the merchant account charges in (set PAYSTACK_CURRENCY). */
export function paystackCurrency(): string {
  return process.env.PAYSTACK_CURRENCY ?? "GHS";
}

export function planPriceKobo(plan: CheckoutPlan): number {
  const override = process.env[`PAYSTACK_PRICE_${plan.toUpperCase()}`];
  const parsed = override ? Number(override) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : PLAN_PRICES_KOBO[plan];
}

/** Formats a plan price for display, e.g. "GH₵290/mo" or "₦29,000/mo". */
export function formatPlanPrice(plan: CheckoutPlan): string {
  const major = planPriceKobo(plan) / 100;
  const currency = paystackCurrency();
  const locale = currency === "NGN" ? "en-NG" : currency === "GHS" ? "en-GH" : "en";
  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(major);
  return `${formatted}/mo`;
}

type PaystackResponse<T> = {
  status: boolean;
  message?: string;
  data: T;
};

type PaystackPlan = {
  plan_code: string;
  name: string;
};

type PaystackTransaction = {
  reference: string;
  amount: number;
  status: string;
  metadata?: Record<string, unknown> | null;
  customer?: { email: string; customer_code: string } | null;
};

type PaystackSubscription = {
  subscription_code: string;
  email_token: string;
  next_payment_date?: string;
  status: string;
  customer?: { email: string; customer_code: string } | null;
};

function isCheckoutPlan(value: unknown): value is CheckoutPlan {
  return value === "standard" || value === "pro" || value === "ultimate";
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type PaystackService = ReturnType<typeof createPaystackService>;

export function createPaystackService(deps: {
  db: Database;
  billing: Pick<BillingService, "getSubscription" | "applyPlanToDomains">;
}) {
  const { db, billing } = deps;

  async function assertConfigured(): Promise<void> {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      throw paystackNotConfiguredError();
    }
  }

  /**
   * Raw Paystack API call with a hard timeout. The official SDK is not used
   * because its `request`-based HTTP layer hangs on dead connections and
   * throws uncaught exceptions on empty response bodies.
   */
  async function paystackFetch<T>(
    path: string,
    method: "GET" | "POST" | "PUT",
    body?: Record<string, unknown>,
  ): Promise<T> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      throw paystackNotConfiguredError();
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT_MS);
    try {
      const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const json = (await response.json()) as {
        status?: boolean;
        message?: string;
        data?: unknown;
      };
      if (!response.ok || json.status === false) {
        throw new PaystackServiceError(
          502,
          "PAYSTACK_API_ERROR",
          json.message ?? `Paystack request failed with status ${response.status}`,
        );
      }
      return json as T;
    } catch (error) {
      if (error instanceof PaystackServiceError) {
        throw error;
      }
      throw new PaystackServiceError(
        502,
        "PAYSTACK_API_ERROR",
        error instanceof Error ? error.message : "Paystack request failed",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function upsertPaystackSubscription(ownerId: string, input: {
    plan: CheckoutPlan;
    status: Subscription["status"];
    customerCode?: string | null;
    customerSubscriptionCode?: string | null;
    currentPeriodEnd?: Date | null;
  }): Promise<void> {
    const existing = await billing.getSubscription(ownerId);
    if (!existing) {
      await db.insert(subscriptions).values({
        ownerId,
        plan: input.plan,
        status: input.status,
        customerCode: input.customerCode ?? null,
        customerSubscriptionCode: input.customerSubscriptionCode ?? null,
        currentPeriodEnd: input.currentPeriodEnd ?? null,
      });
      return;
    }
    await db
      .update(subscriptions)
      .set({
        plan: input.plan,
        status: input.status,
        customerCode: input.customerCode ?? existing.customerCode,
        customerSubscriptionCode: input.customerSubscriptionCode ?? existing.customerSubscriptionCode,
        currentPeriodEnd: input.currentPeriodEnd ?? existing.currentPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing.id));
  }

  /** Best-effort next renewal date from the customer's latest Paystack subscription. */
  async function nextPeriodEndFor(email: string): Promise<Date> {
    try {
      const response = await paystackFetch<PaystackResponse<PaystackSubscription[]>>(
        "/subscription",
        "GET",
      );
      const match = response.data?.find((sub) => sub.customer?.email === email);
      if (match?.next_payment_date) {
        return new Date(match.next_payment_date);
      }
    } catch {
      // fall through to the default below
    }
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  /**
   * Finds or creates the Paystack plan for a billing plan. Env override
   * PAYSTACK_PLAN_<PLAN> skips the lookup entirely.
   */
  async function ensurePlanCode(plan: CheckoutPlan): Promise<string> {
    const override = process.env[`PAYSTACK_PLAN_${plan.toUpperCase()}`];
    if (override) {
      return override;
    }
    const list = await paystackFetch<PaystackResponse<PaystackPlan[]>>("/plan", "GET");
    const existing = list.data?.find((item) => item.name === PLAN_NAME[plan]);
    if (existing?.plan_code) {
      return existing.plan_code;
    }
    const created = await paystackFetch<PaystackResponse<PaystackPlan>>("/plan", "POST", {
      name: PLAN_NAME[plan],
      description: `Ziyarn ${plan} monthly plan`,
      amount: planPriceKobo(plan),
      interval: "monthly",
      currency: paystackCurrency(),
    });
    return created.data.plan_code;
  }

  return {
    /**
     * Prepares a Paystack checkout for a plan upgrade: ensures the plan
     * exists, then initializes a transaction with server-owned metadata
     * (ownerId + plan) and a reference the client popup will use.
     */
    async initializeCheckout(
      ownerId: string,
      input: { plan: CheckoutPlan; email: string },
    ): Promise<{
      reference: string;
      planCode: string;
      amountKobo: number;
      email: string;
      currency: string;
      url: string;
    }> {
      await assertConfigured();
      const planCode = await ensurePlanCode(input.plan);
      const reference = `ziyarn_${randomUUID().replace(/-/g, "")}`;
      const initialized = await paystackFetch<PaystackResponse<PaystackTransaction & { authorization_url: string }>>(
        "/transaction/initialize",
        "POST",
        {
          reference,
          amount: planPriceKobo(input.plan),
          email: input.email,
          plan: planCode,
          currency: paystackCurrency(),
          metadata: { ownerId, plan: input.plan },
        },
      );
      return {
        reference,
        planCode,
        amountKobo: planPriceKobo(input.plan),
        email: input.email,
        currency: paystackCurrency(),
        url: initialized.data?.authorization_url ?? "",
      };
    },

    /**
     * Verifies a checkout reference after the popup succeeded and activates
     * the subscription. Idempotent; the reference maps to a transaction
     * initialized server-side, so ownerId and plan are trustworthy.
     */
    async verifyCheckout(
      ownerId: string,
      input: { reference: string },
    ): Promise<{ plan: CheckoutPlan }> {
      await assertConfigured();
      let response: PaystackResponse<PaystackTransaction> | undefined;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          response = await paystackFetch<PaystackResponse<PaystackTransaction>>(
            `/transaction/verify/${input.reference}`,
            "GET",
          );
          break;
        } catch {
          if (attempt === 2) {
            throw new PaystackServiceError(
              502,
              "PAYSTACK_VERIFY_FAILED",
              "Could not verify the payment with Paystack. Please try again.",
            );
          }
          await sleep(600);
        }
      }
      if (!response?.status || response.data?.status !== "success") {
        throw new PaystackServiceError(
          400,
          "PAYMENT_NOT_SUCCESSFUL",
          "The payment was not successful",
        );
      }
      const data = response.data;
      const plan = data.metadata?.plan;
      if (!isCheckoutPlan(plan) || data.metadata?.ownerId !== ownerId) {
        throw new PaystackServiceError(
          403,
          "FORBIDDEN",
          "This checkout does not belong to your account",
        );
      }
      if (data.amount !== planPriceKobo(plan)) {
        throw new PaystackServiceError(
          400,
          "PAYMENT_AMOUNT_MISMATCH",
          "The payment amount does not match the plan price",
        );
      }
      await upsertPaystackSubscription(ownerId, {
        plan,
        status: "active",
        customerCode: data.customer?.customer_code ?? null,
        currentPeriodEnd: await nextPeriodEndFor(data.customer?.email ?? ""),
      });
      await billing.applyPlanToDomains(ownerId, plan);
      return { plan };
    },

    /** Cancels the owner's Paystack subscription and reverts domains to free. */
    async cancelSubscription(ownerId: string): Promise<void> {
      await assertConfigured();
      const current = await billing.getSubscription(ownerId);
      if (!current?.customerSubscriptionCode) {
        throw new PaystackServiceError(
          404,
          "NO_SUBSCRIPTION",
          "You do not have a Paystack subscription yet",
        );
      }
      const fetched = await paystackFetch<PaystackResponse<PaystackSubscription>>(
        `/subscription/${current.customerSubscriptionCode}`,
        "GET",
      );
      const token = fetched.data?.email_token;
      if (!token) {
        throw new PaystackServiceError(
          409,
          "CANNOT_CANCEL",
          "This subscription cannot be cancelled automatically",
        );
      }
      await paystackFetch<PaystackResponse<unknown>>("/subscription", "POST", {
        code: current.customerSubscriptionCode,
        token,
      });
      await db
        .update(subscriptions)
        .set({ status: "canceled", updatedAt: new Date() })
        .where(eq(subscriptions.id, current.id));
      await billing.applyPlanToDomains(ownerId, "free");
    },

    /**
     * Handles Paystack webhook events (charge.success,
     * subscription.create, subscription.disable). The signature is an
     * HMAC-SHA512 of the raw body with PAYSTACK_WEBHOOK_SECRET.
     */
    async handleWebhook(
      rawBody: string,
      signature: string,
    ): Promise<{ handled: boolean }> {
      const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
      if (!webhookSecret) {
        throw paystackNotConfiguredError();
      }
      const expected = createHmac("sha512", webhookSecret)
        .update(rawBody)
        .digest("hex");
      if (expected !== signature) {
        throw new PaystackServiceError(
          400,
          "PAYSTACK_SIGNATURE_INVALID",
          "Invalid webhook signature",
        );
      }
      let event: {
        event?: string;
        data?: {
          reference?: string;
          amount?: number;
          metadata?: Record<string, unknown> | null;
          customer?: { email: string; customer_code: string } | null;
          subscription_code?: string;
          plan?: { plan_code?: string } | null;
          next_payment_date?: string;
          status?: string;
        } | null;
      };
      try {
        event = JSON.parse(rawBody) as typeof event;
      } catch {
        throw new PaystackServiceError(
          400,
          "PAYSTACK_INVALID_BODY",
          "Invalid webhook body",
        );
      }

      const data = event.data;
      if (!event.event || !data) {
        return { handled: false };
      }

      switch (event.event) {
        case "charge.success": {
          const plan = data.metadata?.plan;
          const ownerId = data.metadata?.ownerId;
          if (!isCheckoutPlan(plan) || typeof ownerId !== "string") {
            return { handled: false };
          }
          if (data.amount !== planPriceKobo(plan)) {
            return { handled: false };
          }
          await upsertPaystackSubscription(ownerId, {
            plan,
            status: "active",
            customerCode: data.customer?.customer_code ?? null,
            currentPeriodEnd: await nextPeriodEndFor(data.customer?.email ?? ""),
          });
          await billing.applyPlanToDomains(ownerId, plan);
          return { handled: true };
        }
        case "subscription.create": {
          if (!data.subscription_code || !data.customer?.customer_code) {
            return { handled: false };
          }
          const [row] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.customerCode, data.customer.customer_code))
            .limit(1);
          if (!row) {
            return { handled: false };
          }
          await db
            .update(subscriptions)
            .set({
              customerSubscriptionCode: data.subscription_code,
              status: data.status === "active" ? "active" : row.status,
              currentPeriodEnd: data.next_payment_date
                ? new Date(data.next_payment_date)
                : row.currentPeriodEnd,
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.id, row.id));
          return { handled: true };
        }
        case "subscription.disable": {
          if (!data.subscription_code) {
            return { handled: false };
          }
          const [row] = await db
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.customerSubscriptionCode, data.subscription_code))
            .limit(1);
          if (!row) {
            return { handled: false };
          }
          await db
            .update(subscriptions)
            .set({ status: "canceled", updatedAt: new Date() })
            .where(eq(subscriptions.id, row.id));
          await billing.applyPlanToDomains(row.ownerId, "free");
          return { handled: true };
        }
        default:
          return { handled: false };
      }
    },
  };
}
