import { createHmac } from "node:crypto"

import { getTableName } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  PLAN_PRICES_KOBO,
  createPaystackService,
  formatPlanPrice,
  paystackCurrency,
  planPriceKobo,
  verifyPaystackSignature,
} from "@repo/api/paystack"

describe("plan prices", () => {
  afterEach(() => {
    delete process.env.PAYSTACK_PRICE_STANDARD
    delete process.env.PAYSTACK_PRICE_PRO
    delete process.env.PAYSTACK_PRICE_ULTIMATE
    delete process.env.PAYSTACK_CURRENCY
  })

  it("has a price for every checkout plan", () => {
    for (const plan of ["standard", "pro", "ultimate"] as const) {
      expect(PLAN_PRICES_KOBO[plan]).toBeGreaterThan(0)
    }
  })

  it("charges more as the plan grows", () => {
    expect(PLAN_PRICES_KOBO.standard).toBeLessThan(PLAN_PRICES_KOBO.pro)
    expect(PLAN_PRICES_KOBO.pro).toBeLessThan(PLAN_PRICES_KOBO.ultimate)
  })

  it("uses the default price when no override is set", () => {
    expect(planPriceKobo("standard")).toBe(PLAN_PRICES_KOBO.standard)
  })

  it("lets the deployment override a price", () => {
    process.env.PAYSTACK_PRICE_STANDARD = "500000"
    expect(planPriceKobo("standard")).toBe(500_000)
  })

  it("ignores an override that is not a positive integer", () => {
    process.env.PAYSTACK_PRICE_STANDARD = "0"
    expect(planPriceKobo("standard")).toBe(PLAN_PRICES_KOBO.standard)

    process.env.PAYSTACK_PRICE_STANDARD = "-100"
    expect(planPriceKobo("standard")).toBe(PLAN_PRICES_KOBO.standard)

    process.env.PAYSTACK_PRICE_STANDARD = "12.5"
    expect(planPriceKobo("standard")).toBe(PLAN_PRICES_KOBO.standard)

    process.env.PAYSTACK_PRICE_STANDARD = "free"
    expect(planPriceKobo("standard")).toBe(PLAN_PRICES_KOBO.standard)
  })

  it("defaults to Ghanaian cedis", () => {
    expect(paystackCurrency()).toBe("GHS")
  })

  it("formats a price the way the page shows it", () => {
    // The pricing page reads planPriceKobo; the dashboard reads this. They
    // must agree, or the advertised price is not the charged price.
    const major = planPriceKobo("standard") / 100
    expect(formatPlanPrice("standard")).toContain(
      new Intl.NumberFormat("en-GH", {
        style: "currency",
        currency: "GHS",
        maximumFractionDigits: 0,
      }).format(major),
    )
    expect(formatPlanPrice("standard")).toContain("/mo")
  })
})

// ---------------------------------------------------------------------------
// Webhook signatures and plan transitions
// ---------------------------------------------------------------------------

const TEST_SECRET = "sk_test_ziyarn_unit_secret"
const OWNER_ID = "owner-1"

type SubscriptionRow = Record<string, unknown>

/**
 * Minimal in-memory stand-in for drizzle plus the billing service.
 *
 * The paystack service's rules live in the events it handles and the writes
 * it makes, so this records subscription writes and domain-plan applications
 * instead of emulating SQL. Subscription reads (`billing.getSubscription`)
 * and writes (`db.insert` / `db.update`) share one store, which is what makes
 * a replay observable as "still one row".
 */
function createHarness(seed: SubscriptionRow[] = []) {
  const subscriptions = [...seed]
  const domainPlanApplications: Array<{ ownerId: string; plan: string }> = []
  let nextId = 1

  const rowsFor = (table: unknown): SubscriptionRow[] => {
    if (!table || typeof table !== "object") return []
    return getTableName(table as never) === "subscriptions" ? subscriptions : []
  }

  const makeQuery = (
    rows: SubscriptionRow[],
    onWrite?: (payload: Record<string, unknown>) => void,
  ) => {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            return (
              onFulfilled: (value: unknown) => unknown,
              onRejected?: (reason: unknown) => unknown,
            ) => Promise.resolve(rows).then(onFulfilled, onRejected)
          }
          if (prop === "from") {
            return (table: unknown) => {
              rows = rowsFor(table)
              return proxy
            }
          }
          if (prop === "values" || prop === "set") {
            return (payload: Record<string, unknown>) => {
              onWrite?.(payload)
              return proxy
            }
          }
          // where, limit, orderBy … keep the chain going
          return () => proxy
        },
      },
    )
    return proxy
  }

  const db = {
    select: () => makeQuery([]),
    insert: (table: unknown) =>
      makeQuery(rowsFor(table), (payload) => {
        subscriptions.push({ id: `sub-${nextId++}`, ...payload })
      }),
    update: (table: unknown) =>
      makeQuery(rowsFor(table), (payload) => {
        for (const row of subscriptions) Object.assign(row, payload)
      }),
  }

  const billing = {
    getSubscription: async (ownerId: string) =>
      (subscriptions.find((row) => row.ownerId === ownerId) as never) ?? null,
    applyPlanToDomains: async (ownerId: string, plan: string) => {
      domainPlanApplications.push({ ownerId, plan })
    },
  }

  const service = createPaystackService({
    db: db as never,
    billing: billing as never,
  })

  return { service, subscriptions, domainPlanApplications }
}

function signBody(body: string, secret = TEST_SECRET): string {
  return createHmac("sha512", secret).update(body).digest("hex")
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

function stubPaystackFetch(
  handler: (url: string, init?: RequestInit) => Response,
) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init),
  )
  vi.stubGlobal("fetch", mock)
  return mock
}

function chargeSuccessBody(metadata: Record<string, unknown>): string {
  return JSON.stringify({
    event: "charge.success",
    data: {
      reference: "ziyarn_ref_1",
      amount: 39_900,
      status: "success",
      metadata,
      customer: { email: "owner@example.com", customer_code: "CUS_x" },
    },
  })
}

beforeEach(() => {
  process.env.PAYSTACK_SECRET_KEY = TEST_SECRET
  // Webhook handling looks up the customer's Paystack subscription before
  // writing; answer that lookup locally so the unit tests never touch the
  // network. Tests that exercise Paystack calls restub fetch themselves.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse({ status: true, data: [] })),
  )
})

afterEach(() => {
  delete process.env.PAYSTACK_SECRET_KEY
  vi.unstubAllGlobals()
})

describe("verifyPaystackSignature", () => {
  it("accepts a signature computed with the secret key", () => {
    const body = '{"event":"charge.success"}'
    expect(verifyPaystackSignature(body, signBody(body), TEST_SECRET)).toBe(true)
  })

  it("rejects a tampered body", () => {
    const body = '{"event":"charge.success","amount":100}'
    expect(
      verifyPaystackSignature(`${body} `, signBody(body), TEST_SECRET),
    ).toBe(false)
  })

  it("rejects a signature made with a different secret", () => {
    const body = '{"event":"charge.success"}'
    expect(
      verifyPaystackSignature(body, signBody(body, "wrong-secret"), TEST_SECRET),
    ).toBe(false)
  })

  it("rejects malformed and empty signatures without throwing", () => {
    const body = '{"event":"charge.success"}'
    expect(verifyPaystackSignature(body, "deadbeef", TEST_SECRET)).toBe(false)
    expect(verifyPaystackSignature(body, "not-hex-at-all", TEST_SECRET)).toBe(false)
    expect(verifyPaystackSignature(body, "", TEST_SECRET)).toBe(false)
  })
})

describe("webhook signature enforcement", () => {
  it("rejects a tampered body with 400", async () => {
    const { service } = createHarness()
    const body = chargeSuccessBody({ ownerId: OWNER_ID, plan: "pro" })

    await expect(service.handleWebhook(`${body} `, signBody(body))).rejects.toThrow(
      expect.objectContaining({
        status: 400,
        code: "PAYSTACK_SIGNATURE_INVALID",
      }),
    )
  })

  it("accepts a valid signature for an event it does not handle", async () => {
    const { service } = createHarness()
    const body = JSON.stringify({ event: "transfer.success", data: {} })

    await expect(
      service.handleWebhook(body, signBody(body)),
    ).resolves.toEqual({ handled: false })
  })

  it("reports 501 when the secret key is not configured", async () => {
    delete process.env.PAYSTACK_SECRET_KEY
    const { service } = createHarness()
    const body = chargeSuccessBody({ ownerId: OWNER_ID, plan: "pro" })

    await expect(service.handleWebhook(body, signBody(body))).rejects.toThrow(
      expect.objectContaining({ status: 501, code: "PAYSTACK_NOT_CONFIGURED" }),
    )
  })
})

describe("charge.success", () => {
  it("stores the subscription and applies the plan to the owner's domains", async () => {
    const { service, subscriptions, domainPlanApplications } = createHarness()
    const body = chargeSuccessBody({ ownerId: OWNER_ID, plan: "pro" })

    await expect(service.handleWebhook(body, signBody(body))).resolves.toEqual({
      handled: true,
    })

    expect(subscriptions).toHaveLength(1)
    expect(subscriptions[0]).toMatchObject({
      ownerId: OWNER_ID,
      plan: "pro",
      status: "active",
      customerCode: "CUS_x",
    })
    expect(domainPlanApplications).toContainEqual({
      ownerId: OWNER_ID,
      plan: "pro",
    })
  })

  it("is idempotent when the same event is replayed", async () => {
    const { service, subscriptions, domainPlanApplications } = createHarness()
    const body = chargeSuccessBody({ ownerId: OWNER_ID, plan: "pro" })
    const signature = signBody(body)

    await service.handleWebhook(body, signature)
    await service.handleWebhook(body, signature)

    expect(subscriptions).toHaveLength(1)
    expect(subscriptions[0]).toMatchObject({
      ownerId: OWNER_ID,
      plan: "pro",
      status: "active",
    })
    expect(domainPlanApplications).toHaveLength(2)
  })

  it("ignores an event whose metadata does not identify an owner", async () => {
    const { service, subscriptions, domainPlanApplications } = createHarness()
    const body = chargeSuccessBody({ plan: "pro" })

    await expect(
      service.handleWebhook(body, signBody(body)),
    ).resolves.toEqual({ handled: false })
    expect(subscriptions).toHaveLength(0)
    expect(domainPlanApplications).toHaveLength(0)
  })
})

describe("subscription events", () => {
  it("stores the subscription code and renewal date from subscription.create", async () => {
    const { service, subscriptions } = createHarness([
      {
        id: "sub-1",
        ownerId: OWNER_ID,
        plan: "pro",
        status: "active",
        customerCode: "CUS_x",
        customerSubscriptionCode: null,
        currentPeriodEnd: null,
      },
    ])
    const body = JSON.stringify({
      event: "subscription.create",
      data: {
        subscription_code: "SUB_x",
        email_token: "tok",
        status: "active",
        next_payment_date: "2026-11-22T00:00:00.000Z",
        customer: { email: "owner@example.com", customer_code: "CUS_x" },
      },
    })

    await expect(service.handleWebhook(body, signBody(body))).resolves.toEqual({
      handled: true,
    })

    expect(subscriptions[0]?.customerSubscriptionCode).toBe("SUB_x")
    expect(
      (subscriptions[0]?.currentPeriodEnd as Date).toISOString(),
    ).toBe("2026-11-22T00:00:00.000Z")
  })

  it("ignores subscription.create for a customer it has never seen", async () => {
    const { service, subscriptions } = createHarness()
    const body = JSON.stringify({
      event: "subscription.create",
      data: {
        subscription_code: "SUB_x",
        status: "active",
        customer: { email: "stranger@example.com", customer_code: "CUS_other" },
      },
    })

    await expect(
      service.handleWebhook(body, signBody(body)),
    ).resolves.toEqual({ handled: false })
    expect(subscriptions).toHaveLength(0)
  })

  it("cancels on subscription.disable and reverts domains to free", async () => {
    const { service, subscriptions, domainPlanApplications } = createHarness([
      {
        id: "sub-1",
        ownerId: OWNER_ID,
        plan: "pro",
        status: "active",
        customerCode: "CUS_x",
        customerSubscriptionCode: "SUB_x",
        currentPeriodEnd: null,
      },
    ])
    const body = JSON.stringify({
      event: "subscription.disable",
      data: { subscription_code: "SUB_x" },
    })

    await expect(service.handleWebhook(body, signBody(body))).resolves.toEqual({
      handled: true,
    })

    expect(subscriptions[0]?.status).toBe("canceled")
    expect(domainPlanApplications).toContainEqual({
      ownerId: OWNER_ID,
      plan: "free",
    })
  })
})

describe("verifyCheckout", () => {
  it("leaves the plan alone when the payment was not successful", async () => {
    const { service, subscriptions, domainPlanApplications } = createHarness()
    stubPaystackFetch(() =>
      jsonResponse({ status: true, data: { status: "failed" } }),
    )

    await expect(
      service.verifyCheckout(OWNER_ID, { reference: "ziyarn_ref_1" }),
    ).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "PAYMENT_NOT_SUCCESSFUL" }),
    )

    expect(subscriptions).toHaveLength(0)
    expect(domainPlanApplications).toHaveLength(0)
  })

  it("refuses a checkout that belongs to another owner", async () => {
    const { service, subscriptions } = createHarness()
    stubPaystackFetch(() =>
      jsonResponse({
        status: true,
        data: {
          status: "success",
          amount: 11_900,
          metadata: { ownerId: "someone-else", plan: "standard" },
        },
      }),
    )

    await expect(
      service.verifyCheckout(OWNER_ID, { reference: "ziyarn_ref_1" }),
    ).rejects.toThrow(
      expect.objectContaining({ status: 403, code: "FORBIDDEN" }),
    )
    expect(subscriptions).toHaveLength(0)
  })

  it("applies the plan for a successful owned checkout", async () => {
    const { service, subscriptions, domainPlanApplications } = createHarness()
    stubPaystackFetch((url) => {
      if (url.includes("/transaction/verify/")) {
        return jsonResponse({
          status: true,
          data: {
            status: "success",
            amount: 11_900,
            metadata: { ownerId: OWNER_ID, plan: "standard" },
            customer: { email: "owner@example.com", customer_code: "CUS_x" },
          },
        })
      }
      // latestSubscriptionFor
      return jsonResponse({ status: true, data: [] })
    })

    await expect(
      service.verifyCheckout(OWNER_ID, { reference: "ziyarn_ref_1" }),
    ).resolves.toEqual({ plan: "standard" })

    expect(subscriptions[0]).toMatchObject({
      ownerId: OWNER_ID,
      plan: "standard",
      status: "active",
    })
    expect(domainPlanApplications).toContainEqual({
      ownerId: OWNER_ID,
      plan: "standard",
    })
  })
})

describe("cancelSubscription", () => {
  it("refuses an owner with no stored Paystack subscription", async () => {
    const { service } = createHarness()

    await expect(service.cancelSubscription(OWNER_ID)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NO_SUBSCRIPTION" }),
    )
  })

  it("disables the subscription at Paystack and reverts domains to free", async () => {
    const { service, subscriptions, domainPlanApplications } = createHarness([
      {
        id: "sub-1",
        ownerId: OWNER_ID,
        plan: "pro",
        status: "active",
        customerCode: "CUS_x",
        customerSubscriptionCode: "SUB_x",
        currentPeriodEnd: null,
      },
    ])
    stubPaystackFetch((url, init) => {
      if (url.endsWith("/subscription/SUB_x")) {
        return jsonResponse({
          status: true,
          data: { email_token: "tok", subscription_code: "SUB_x" },
        })
      }
      if (url.endsWith("/subscription/disable") && init?.method === "POST") {
        return jsonResponse({ status: true, data: {} })
      }
      throw new Error(`unexpected request ${init?.method ?? "GET"} ${url}`)
    })

    await expect(service.cancelSubscription(OWNER_ID)).resolves.toBeUndefined()

    expect(subscriptions[0]?.status).toBe("canceled")
    expect(domainPlanApplications).toContainEqual({
      ownerId: OWNER_ID,
      plan: "free",
    })
  })
})
