import { createHmac } from "node:crypto"

import { eq } from "drizzle-orm"
import { beforeAll, describe, expect, it } from "vitest"

import { createBillingService } from "@repo/api/billing/server"
import {
  createPaystackService,
  planPriceKobo,
  type PaystackService,
} from "@repo/api/paystack/server"
import type { Database } from "@repo/database"
import { domains, subscriptions, user } from "@repo/database/schema"

/**
 * Live Paystack test-mode matrix.
 *
 * Opt-in: skipped unless PAYSTACK_LIVE_TEST=1. This talks to the real
 * Paystack API with the deployment's (test-mode) keys and writes to whatever
 * DATABASE_URL points at. It must only ever be run against a **disposable
 * Neon branch**, never production:
 *
 *   PAYSTACK_LIVE_TEST=1 \
 *   DATABASE_URL="$(cat /tmp/paystack-branch-url)" \
 *   PAYSTACK_SECRET_KEY=... BASE_APP_URL=http://localhost:3000 \
 *   pnpm --filter @repo/api exec vitest run src/paystack/live.test.ts
 *
 * The matrix follows one @example.com owner in that branch through:
 * initialize → unpaid verify → real charge → webhook → replay → tampered
 * signature → re-verify → upgrade → downgrade → reconcile → cancel → failed
 * payment, asserting the database after every step.
 */

const live = process.env.PAYSTACK_LIVE_TEST === "1"
const PAYSTACK_API = "https://api.paystack.co"
const TEST_CARD = {
  number: "4084084084084081",
  cvv: "408",
  expiry_month: "12",
  expiry_year: "27",
}
// Cards Paystack documents as failing in test mode.
const FAILING_CARDS = [
  { number: "5060666666666666666", cvv: "408", expiry_month: "12", expiry_year: "27" },
  { number: "5060990400434029204", cvv: "408", expiry_month: "12", expiry_year: "27" },
]

type Json = Record<string, unknown>

let database: Database
let paystack: PaystackService
let secretKey = ""
let ownerId = ""
let ownerEmail = ""
let runEmail = ""

const state: {
  standardPlanCode: string
  standardAmount: number
  unpaidReference: string
  charge: Json | null
} = {
  standardPlanCode: "",
  standardAmount: 0,
  unpaidReference: "",
  charge: null,
}

type PaystackEnvelope = {
  status?: boolean
  message?: string
  data?: Json
}

async function paystackRaw(
  path: string,
  method: "GET" | "POST",
  body?: Json,
): Promise<{ ok: boolean; json: PaystackEnvelope }> {
  const response = await fetch(`${PAYSTACK_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  const json = (await response.json()) as PaystackEnvelope
  return { ok: response.ok && json.status !== false, json }
}

async function paystackRequest(
  path: string,
  method: "GET" | "POST",
  body?: Json,
): Promise<Json> {
  const { ok, json } = await paystackRaw(path, method, body)
  if (!ok || !json.data) {
    throw new Error(`${method} ${path} failed: ${json.message ?? "no data"}`)
  }
  return json.data
}

/** Drives a card charge to a terminal state (PIN 0000, OTP 123456 in test mode). */
async function charge(input: {
  amount: number
  card: (typeof TEST_CARD) | (typeof FAILING_CARDS)[number]
  metadata: Json
  plan?: string
  acceptDecline?: boolean
}): Promise<Json> {
  const first = await paystackRaw("/charge", "POST", {
    email: runEmail,
    amount: input.amount,
    card: input.card,
    metadata: input.metadata,
    ...(input.plan ? { plan: input.plan } : {}),
  })
  if (!first.ok || !first.json.data) {
    const declined = first.json.data
    // Declined cards come back as HTTP 400 with the failed transaction in
    // `data` ("Charge attempted"); that is a test outcome, not an API error.
    if (
      input.acceptDecline &&
      declined?.status === "failed" &&
      typeof declined.reference === "string"
    ) {
      return declined
    }
    throw new Error(`POST /charge failed: ${first.json.message ?? "no data"}`)
  }
  let data = first.json.data
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const status = String(data.status)
    if (status === "success" || status === "failed") return data
    const reference = String(data.reference)
    if (status === "send_pin") {
      data = await paystackRequest("/charge/submit_pin", "POST", {
        pin: "0000",
        reference,
      })
    } else if (status === "send_otp") {
      data = await paystackRequest("/charge/submit_otp", "POST", {
        otp: "123456",
        reference,
      })
    } else if (status === "send_birthday") {
      data = await paystackRequest("/charge/submit_birthday", "POST", {
        birthday: "1990-01-01",
        reference,
      })
    } else {
      throw new Error(
        `unexpected charge status ${status}: ${JSON.stringify(data).slice(0, 300)}`,
      )
    }
  }
  throw new Error("charge never reached a terminal state")
}

async function deliverWebhook(event: string, data: Json) {
  const body = JSON.stringify({ event, data })
  const signature = createHmac("sha512", secretKey).update(body).digest("hex")
  return paystack.handleWebhook(body, signature)
}

async function fetchSubscriptionRow() {
  const [row] = await database
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.ownerId, ownerId))
    .limit(1)
  return row ?? null
}

async function expectDomainPlan(plan: string) {
  const rows = await database
    .select({ plan: domains.plan })
    .from(domains)
    .where(eq(domains.ownerId, ownerId))
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.map((row) => row.plan)).toEqual(rows.map(() => plan))
}

describe.skipIf(!live)("live Paystack test-mode matrix", () => {
  beforeAll(async () => {
    const { db } = await import("@repo/database")
    database = db
    secretKey = process.env.PAYSTACK_SECRET_KEY ?? ""
    expect(secretKey).toMatch(/^sk_test_/)
    const billing = createBillingService({ db: database })
    paystack = createPaystackService({ db: database, billing })
    const candidates = await database
      .select({ ownerId: domains.ownerId, email: user.email })
      .from(domains)
      .innerJoin(user, eq(user.id, domains.ownerId))
    const target = candidates.find((candidate) =>
      candidate.email.endsWith("@example.com"),
    )
    if (!target) {
      throw new Error(
        "no @example.com owner in this database — refusing to run against a real account",
      )
    }
    ownerId = target.ownerId
    ownerEmail = target.email
    // A fresh alias per run keeps the Paystack customer (and its
    // subscription) independent from earlier runs of this harness.
    const [localPart, mailDomain] = ownerEmail.split("@")
    runEmail = `${localPart}+live${Date.now().toString(36)}@${mailDomain}`
    // Clean slate inside the disposable branch.
    await database
      .delete(subscriptions)
      .where(eq(subscriptions.ownerId, ownerId))
    await database
      .update(domains)
      .set({ plan: "free" })
      .where(eq(domains.ownerId, ownerId))
  })

  it("initializes a real checkout against Paystack", async () => {
    const checkout = await paystack.initializeCheckout(ownerId, {
      plan: "standard",
      email: runEmail,
    })
    expect(checkout.reference).toMatch(/^ziyarn_[0-9a-f]{32}$/)
    expect(checkout.url).toMatch(/^https:\/\/checkout\.paystack\.com\//)
    expect(checkout.planCode).toBeTruthy()
    expect(checkout.amountKobo).toBeGreaterThan(0)
    state.standardPlanCode = checkout.planCode
    state.standardAmount = checkout.amountKobo
    state.unpaidReference = checkout.reference
  })

  it("refuses an unpaid transaction and leaves the plan alone", async () => {
    await expect(
      paystack.verifyCheckout(ownerId, { reference: state.unpaidReference }),
    ).rejects.toMatchObject({ code: "PAYMENT_NOT_SUCCESSFUL" })
    expect(await fetchSubscriptionRow()).toBeNull()
    await expectDomainPlan("free")
  })

  it("applies the plan when a real charge's webhook arrives", async () => {
    const charged = await charge({
      amount: state.standardAmount,
      card: TEST_CARD,
      metadata: { ownerId, plan: "standard" },
      plan: state.standardPlanCode,
    })
    expect(String(charged.status)).toBe("success")
    expect(Number(charged.amount)).toBe(state.standardAmount)
    state.charge = charged

    await expect(deliverWebhook("charge.success", charged)).resolves.toEqual({
      handled: true,
    })
    const row = await fetchSubscriptionRow()
    expect(row).toMatchObject({ plan: "standard", status: "active" })
    expect(row?.customerCode).toBeTruthy()
    await expectDomainPlan("standard")
  })

  it("is idempotent when the same charge.success is replayed", async () => {
    await expect(
      deliverWebhook("charge.success", state.charge!),
    ).resolves.toEqual({ handled: true })
    const rows = await database
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.ownerId, ownerId))
    expect(rows).toHaveLength(1)
    const row = await fetchSubscriptionRow()
    expect(row).toMatchObject({ plan: "standard", status: "active" })
    await expectDomainPlan("standard")
  })

  it("rejects a tampered webhook body", async () => {
    const body = JSON.stringify({ event: "charge.success", data: state.charge })
    const signature = createHmac("sha512", secretKey).update(body).digest("hex")
    await expect(paystack.handleWebhook(`${body} `, signature)).rejects.toMatchObject(
      { code: "PAYSTACK_SIGNATURE_INVALID" },
    )
  })

  it("verifies the successful reference again without duplicating", async () => {
    const result = await paystack.verifyCheckout(ownerId, {
      reference: String(state.charge!.reference),
    })
    expect(result).toEqual({ plan: "standard" })
    const rows = await database
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.ownerId, ownerId))
    expect(rows).toHaveLength(1)
  })

  it("upgrades the plan", async () => {
    const proCheckout = await paystack.initializeCheckout(ownerId, {
      plan: "pro",
      email: runEmail,
    })
    const charged = await charge({
      amount: proCheckout.amountKobo,
      card: TEST_CARD,
      metadata: { ownerId, plan: "pro" },
    })
    expect(String(charged.status)).toBe("success")
    const applied = await paystack.verifyCheckout(ownerId, {
      reference: String(charged.reference),
    })
    expect(applied).toEqual({ plan: "pro" })
    expect(await fetchSubscriptionRow()).toMatchObject({ plan: "pro", status: "active" })
    await expectDomainPlan("pro")
  })

  it("downgrades the plan", async () => {
    const standardCheckout = await paystack.initializeCheckout(ownerId, {
      plan: "standard",
      email: runEmail,
    })
    const charged = await charge({
      amount: standardCheckout.amountKobo,
      card: TEST_CARD,
      metadata: { ownerId, plan: "standard" },
    })
    expect(String(charged.status)).toBe("success")
    const applied = await paystack.verifyCheckout(ownerId, {
      reference: String(charged.reference),
    })
    expect(applied).toEqual({ plan: "standard" })
    expect(await fetchSubscriptionRow()).toMatchObject({ plan: "standard" })
    await expectDomainPlan("standard")
  })

  it("recovers a paid-but-unapplied checkout through reconcile", async () => {
    const charged = await charge({
      amount: planPriceKobo("pro"),
      card: TEST_CARD,
      metadata: { ownerId, plan: "pro" },
    })
    expect(String(charged.status)).toBe("success")

    const reconciled = await paystack.reconcileCheckout(ownerId, {
      email: runEmail,
    })
    expect(reconciled).toMatchObject({ applied: true, plan: "pro" })
    expect(await fetchSubscriptionRow()).toMatchObject({ plan: "pro", status: "active" })
    await expectDomainPlan("pro")

    const second = await paystack.reconcileCheckout(ownerId, {
      email: runEmail,
    })
    expect(second.applied).toBe(false)
  })

  it("cancels the real subscription and reverts domains to free", async () => {
    let row = await fetchSubscriptionRow()
    if (!row?.customerSubscriptionCode) {
      // The Charge API does not create a subscription by itself: create one
      // from the customer's reusable authorization, then let the real
      // subscription object flow through the webhook handler.
      const created = await paystackRequest("/subscription", "POST", {
        customer: row?.customerCode ?? runEmail,
        plan: state.standardPlanCode,
      })
      const subscriptionCode = String(created.subscription_code)
      const subscription = await paystackRequest(
        `/subscription/${subscriptionCode}`,
        "GET",
      )
      await expect(
        deliverWebhook("subscription.create", subscription),
      ).resolves.toEqual({ handled: true })
      row = await fetchSubscriptionRow()
      expect(row?.customerSubscriptionCode).toBe(subscriptionCode)
    }

    await expect(paystack.cancelSubscription(ownerId)).resolves.toBeUndefined()
    row = await fetchSubscriptionRow()
    expect(row?.status).toBe("canceled")
    await expectDomainPlan("free")
  })

  it("leaves the plan alone when a payment fails", async () => {
    let failed: Json | null = null
    let lastError: unknown = null
    for (const card of FAILING_CARDS) {
      try {
        const charged = await charge({
          amount: state.standardAmount,
          card,
          metadata: { ownerId, plan: "pro" },
          acceptDecline: true,
        })
        if (String(charged.status) === "failed") {
          failed = charged
          break
        }
      } catch (error) {
        lastError = error
      }
    }
    if (!failed) {
      throw new Error(`no failing test card produced a failed charge: ${String(lastError)}`)
    }

    await expect(
      paystack.verifyCheckout(ownerId, { reference: String(failed.reference) }),
    ).rejects.toMatchObject({ code: "PAYMENT_NOT_SUCCESSFUL" })
    expect(await fetchSubscriptionRow()).toMatchObject({ status: "canceled" })
    await expectDomainPlan("free")
  })
})
