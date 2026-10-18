import { afterEach, describe, expect, it } from "vitest"

import {
  PLAN_PRICES_KOBO,
  formatPlanPrice,
  paystackCurrency,
  planPriceKobo,
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
