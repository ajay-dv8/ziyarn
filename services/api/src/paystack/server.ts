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

/**
 * Public base URL of this deployment. Used to build Paystack return URLs so a
 * hosted checkout comes back to the app instead of a dead end. Never
 * NEXT_PUBLIC_* — this runs server-side only.
 */
export function paystackReturnBase(): string {
  return (
    process.env.BASE_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  );
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
  /** Minor units (pesewas for GHS). This is what Paystack actually charges. */
  amount?: number;
  currency?: string;
};

type PaystackTransaction = {
  reference: string;
  amount: number;
  status: string;
  created_at?: string;
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

  /**
   * Best-effort lookup of the customer's Paystack subscription. The first
   * charge on a plan creates it, so it may not exist seconds after a payment —
   * both fields fall back to null and callers degrade gracefully.
   */
  async function latestSubscriptionFor(email: string): Promise<{
    code: string | null;
    nextPaymentDate: Date | null;
  }> {
    if (!email) {
      return { code: null, nextPaymentDate: null };
    }
    try {
      const response = await paystackFetch<PaystackResponse<PaystackSubscription[]>>(
        "/subscription",
        "GET",
      );
      const match = response.data?.find((sub) => sub.customer?.email === email);
      return {
        code: match?.subscription_code ?? null,
        nextPaymentDate: match?.next_payment_date
          ? new Date(match.next_payment_date)
          : null,
      };
    } catch {
      return { code: null, nextPaymentDate: null };
    }
  }

  /** Renewal date, defaulting to 30 days out when Paystack has not reported one. */
  function periodEndOrDefault(nextPaymentDate: Date | null): Date {
    return nextPaymentDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  /**
   * Finds or creates the Paystack plan for a billing plan, returning the plan
   * object so callers can read the amount Paystack will actually charge.
   *
   * IMPORTANT: when a `plan` is sent to /transaction/initialize, Paystack uses
   * the PLAN's amount and ignores the `amount` parameter. The dashboard amount
   * is therefore the real price. Plans are matched by name (or pinned via
   * PAYSTACK_PLAN_<PLAN>), so a plan whose amount was edited in the dashboard is
   * reused as-is — trust `amount` here rather than planPriceKobo().
   */
  async function ensurePlan(plan: CheckoutPlan): Promise<PaystackPlan> {
    const override = process.env[`PAYSTACK_PLAN_${plan.toUpperCase()}`];
    if (override) {
      // Read the pinned plan so the reported amount is the real charge. A
      // failure here is not fatal: fall back to the code and the env price.
      try {
        const fetched = await paystackFetch<PaystackResponse<PaystackPlan>>(
          `/plan/${override}`,
          "GET",
        );
        return { ...fetched.data, plan_code: override };
      } catch {
        return { plan_code: override, name: PLAN_NAME[plan] };
      }
    }
    const list = await paystackFetch<PaystackResponse<PaystackPlan[]>>("/plan", "GET");
    const existing = list.data?.find((item) => item.name === PLAN_NAME[plan]);
    if (existing?.plan_code) {
      return existing;
    }
    const created = await paystackFetch<PaystackResponse<PaystackPlan>>("/plan", "POST", {
      name: PLAN_NAME[plan],
      description: `Ziyarn ${plan} monthly plan`,
      amount: planPriceKobo(plan),
      interval: "monthly",
      currency: paystackCurrency(),
    });
    return created.data;
  }

  return {
    /**
     * Prepares a Paystack checkout for a plan upgrade: resolves the plan,
     * then initializes a transaction with server-owned metadata (ownerId +
     * plan) and a reference the client popup will use.
     *
     * The charged amount is the Paystack PLAN's amount. If that differs from
     * planPriceKobo() the checkout still proceeds (never charge a stale number)
     * but `priceDrifted` is surfaced so the mismatch is visible.
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
      priceDrifted: boolean;
    }> {
      await assertConfigured();
      const paystackPlan = await ensurePlan(input.plan);
      const expectedKobo = planPriceKobo(input.plan);
      const amountKobo = paystackPlan.amount ?? expectedKobo;
      const priceDrifted = amountKobo !== expectedKobo;
      if (priceDrifted) {
        console.warn(
          `[paystack] ${input.plan}: Paystack plan ${paystackPlan.plan_code} charges ${amountKobo} ` +
            `but PAYSTACK_PRICE_* expects ${expectedKobo}. The plan amount wins — sync the dashboard or env.`,
        );
      }
      const reference = `ziyarn_${randomUUID().replace(/-/g, "")}`;
      const initialized = await paystackFetch<PaystackResponse<PaystackTransaction & { authorization_url: string }>>(
        "/transaction/initialize",
        "POST",
        {
          reference,
          amount: amountKobo,
          email: input.email,
          plan: paystackPlan.plan_code,
          currency: paystackCurrency(),
          // Send a hosted checkout back to the billing page so the plan is
          // reconciled on return. Without this the customer pays and lands on a
          // dead end — the popup verify call never runs.
          callback_url: `${paystackReturnBase()}/dashboard/billing?paystack=return`,
          metadata: { ownerId, plan: input.plan },
        },
      );
      return {
        reference,
        planCode: paystackPlan.plan_code,
        amountKobo,
        email: input.email,
        currency: paystackCurrency(),
        url: initialized.data?.authorization_url ?? "",
        priceDrifted,
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
      // NOTE: we deliberately do NOT gate activation on the charged amount.
      // `reference` is server-generated (`ziyarn_<uuid>`) and `metadata` is
      // server-owned, so the ownerId check above is the complete authorization
      // boundary. Re-deriving an expected price from PAYSTACK_PRICE_* compared
      // two independent sources of truth (env vs the Paystack plan amount) and
      // silently rejected valid, already-paid checkouts whenever they drifted.
      const expectedKobo = planPriceKobo(plan);
      if (data.amount !== expectedKobo) {
        console.warn(
          `[paystack] verify ${input.reference}: charged ${data.amount} but planPriceKobo(${plan}) is ${expectedKobo}. Activating anyway.`,
        );
      }
      const customerEmail = data.customer?.email ?? "";
      const latestSubscription = await latestSubscriptionFor(customerEmail);
      await upsertPaystackSubscription(ownerId, {
        plan,
        status: "active",
        customerCode: data.customer?.customer_code ?? null,
        customerSubscriptionCode: latestSubscription.code,
        currentPeriodEnd: periodEndOrDefault(latestSubscription.nextPaymentDate),
      });
      await billing.applyPlanToDomains(ownerId, plan);
      return { plan };
    },

    /**
     * Recovers a paid-but-unapplied checkout.
     *
     * Scans recent Paystack transactions for a successful charge whose
     * server-owned metadata names this owner and applies the plan. This is the
     * repair path for a checkout whose browser verify was lost (closed tab,
     * network drop, a deploy mid-checkout) and whose webhook was never
     * configured or also failed. Idempotent — safe to call repeatedly.
     */
    async reconcileCheckout(
      ownerId: string,
      input: { email: string },
    ): Promise<{
      applied: boolean;
      plan: CheckoutPlan | null;
      reference: string | null;
      message: string;
    }> {
      await assertConfigured();
      const transactions = await paystackFetch<PaystackResponse<PaystackTransaction[]>>(
        "/transaction?per_page=50",
        "GET",
      );

      // Sort explicitly rather than trusting the endpoint's default order — a
      // stale payment would otherwise under-deliver the owner's latest plan.
      const paid = (transactions.data ?? [])
        .flatMap((transaction) => {
          const plan = transaction.metadata?.plan;
          if (transaction.status !== "success") return [];
          if (transaction.metadata?.ownerId !== ownerId) return [];
          if (!isCheckoutPlan(plan)) return [];
          return [{ plan, transaction }];
        })
        .sort((left, right) =>
          (right.transaction.created_at ?? "").localeCompare(
            left.transaction.created_at ?? "",
          ),
        );
      const latest = paid[0];
      if (!latest) {
        return {
          applied: false,
          plan: null,
          reference: null,
          message: "No completed Paystack payment was found for this account.",
        };
      }

      const existing = await billing.getSubscription(ownerId);
      if (existing?.plan === latest.plan && existing.status === "active") {
        return {
          applied: false,
          plan: latest.plan,
          reference: latest.transaction.reference,
          message: "Your payment is already applied.",
        };
      }

      const customerEmail = latest.transaction.customer?.email ?? input.email ?? "";
      const latestSubscription = await latestSubscriptionFor(customerEmail);
      await upsertPaystackSubscription(ownerId, {
        plan: latest.plan,
        status: "active",
        customerCode: latest.transaction.customer?.customer_code ?? null,
        customerSubscriptionCode: latestSubscription.code,
        currentPeriodEnd: periodEndOrDefault(latestSubscription.nextPaymentDate),
      });
      await billing.applyPlanToDomains(ownerId, latest.plan);
      return {
        applied: true,
        plan: latest.plan,
        reference: latest.transaction.reference,
        message: "Payment found — your plan is now active.",
      };
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
          // Never silently drop a paid event. Returning `{handled:false}` here
          // answered Paystack with 200, so it never retried and the charge was
          // lost permanently. Drift is logged, not gated — the ownerId metadata
          // is server-owned and the reference is server-generated.
          const expectedKobo = planPriceKobo(plan);
          if (data.amount !== expectedKobo) {
            console.warn(
              `[paystack] charge.success ${data.reference ?? ""}: amount ${data.amount} != planPriceKobo(${plan}) ${expectedKobo}. Activating anyway.`,
            );
          }
          const customerEmail = data.customer?.email ?? "";
          const latestSubscription = await latestSubscriptionFor(customerEmail);
          await upsertPaystackSubscription(ownerId, {
            plan,
            status: "active",
            customerCode: data.customer?.customer_code ?? null,
            customerSubscriptionCode:
              latestSubscription.code ?? undefined,
            currentPeriodEnd: periodEndOrDefault(latestSubscription.nextPaymentDate),
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
