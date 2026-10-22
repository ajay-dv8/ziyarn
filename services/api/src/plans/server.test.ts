import { describe, expect, it } from "vitest"

import {
  PlanLimitError,
  assertCanCreateDomain,
  assertCanCreateProduct,
  assertCanCreateWorkspace,
  assertCanStartConversation,
  clampWidgetVariantForPlan,
  getPlanLimits,
  highestPlan,
  planAllowsWidgetVariant,
} from "@repo/api/plans"

describe("getPlanLimits", () => {
  it("gives every plan a limit set", () => {
    for (const plan of ["free", "standard", "pro", "ultimate", "custom"] as const) {
      const limits = getPlanLimits(plan)
      expect(limits.maxDomains).toBeGreaterThan(0)
      expect(limits.maxMembers).toBeGreaterThan(0)
      expect(limits.creditsPerMonth).toBeGreaterThan(0)
    }
  })

  it("keeps the free plan on one domain, one member and no emails", () => {
    const free = getPlanLimits("free")
    expect(free.maxDomains).toBe(1)
    expect(free.maxMembers).toBe(1)
    expect(free.emailsPerMonth).toBe(0)
    expect(free.maxProductsPerDomain).toBe(0)
  })

  it("steps the limits up with the tier", () => {
    const free = getPlanLimits("free")
    const plus = getPlanLimits("standard")
    const business = getPlanLimits("pro")
    const enterprise = getPlanLimits("ultimate")

    expect(plus.maxDomains).toBeGreaterThan(free.maxDomains)
    expect(business.maxDomains).toBeGreaterThan(plus.maxDomains)
    expect(enterprise.maxDomains).toBeGreaterThan(business.maxDomains)
    expect(plus.creditsPerMonth).toBeGreaterThan(free.creditsPerMonth)
    expect(business.creditsPerMonth).toBeGreaterThan(plus.creditsPerMonth)
    expect(enterprise.creditsPerMonth).toBeGreaterThan(business.creditsPerMonth)
  })

  it("leaves the custom plan unlimited", () => {
    const custom = getPlanLimits("custom")
    expect(custom.maxDomains).toBe(Number.POSITIVE_INFINITY)
    expect(custom.maxMembers).toBe(Number.POSITIVE_INFINITY)
    expect(custom.emailsPerMonth).toBe(Number.POSITIVE_INFINITY)
  })
})

describe("highestPlan", () => {
  it("returns the highest plan it is given", () => {
    expect(highestPlan(["free", "pro"])).toBe("pro")
    expect(highestPlan(["standard", "free", "ultimate"])).toBe("ultimate")
  })

  it("ranks custom above every other plan", () => {
    // MAX(plan) in SQL would rank "custom" below "free" and downgrade the
    // account, so the ranking is explicit.
    expect(highestPlan(["custom", "free"])).toBe("custom")
    expect(highestPlan(["custom", "ultimate"])).toBe("custom")
  })

  it("falls back to free for empty or unusable input", () => {
    expect(highestPlan([])).toBe("free")
    expect(highestPlan([null, undefined])).toBe("free")
    expect(highestPlan(["not-a-plan"])).toBe("free")
  })

  it("ignores a single unusable plan rather than failing", () => {
    expect(highestPlan(["nonsense", "pro"])).toBe("pro")
  })
})

describe("assertCanCreateDomain", () => {
  it("allows a domain below the limit", () => {
    expect(() =>
      assertCanCreateDomain(getPlanLimits("standard"), 2),
    ).not.toThrow()
  })

  it("refuses a domain at the limit", () => {
    expect(() =>
      assertCanCreateDomain(getPlanLimits("standard"), 3),
    ).toThrow(PlanLimitError)
  })

  it("never refuses an unlimited plan", () => {
    expect(() =>
      assertCanCreateDomain(getPlanLimits("custom"), 10_000),
    ).not.toThrow()
  })
})

describe("assertCanCreateWorkspace", () => {
  it("refuses a team at the limit", () => {
    expect(() =>
      assertCanCreateWorkspace(getPlanLimits("free"), 1),
    ).toThrow(PlanLimitError)
  })

  it("allows a team below the limit", () => {
    expect(() =>
      assertCanCreateWorkspace(getPlanLimits("free"), 0),
    ).not.toThrow()
  })
})

describe("assertCanCreateProduct", () => {
  it("refuses a product on a plan that has none", () => {
    expect(() =>
      assertCanCreateProduct(getPlanLimits("free"), 1),
    ).toThrow(PlanLimitError)
  })

  it("allows a product below the limit", () => {
    expect(() =>
      assertCanCreateProduct(getPlanLimits("standard"), 10),
    ).not.toThrow()
  })
})

describe("assertCanStartConversation", () => {
  it("refuses a conversation at the daily limit", () => {
    expect(() =>
      assertCanStartConversation(getPlanLimits("free"), 100),
    ).toThrow(PlanLimitError)
  })

  it("allows a conversation below the daily limit", () => {
    expect(() =>
      assertCanStartConversation(getPlanLimits("free"), 99),
    ).not.toThrow()
  })
})

describe("widget allowance", () => {
  it("gives the free plan the classic widget only", () => {
    expect(planAllowsWidgetVariant("free", "classic")).toBe(true)
    expect(planAllowsWidgetVariant("free", "glow")).toBe(false)
    expect(planAllowsWidgetVariant("free", "sleek")).toBe(false)
  })

  it("gives paid plans every widget", () => {
    expect(planAllowsWidgetVariant("standard", "glow")).toBe(true)
    expect(planAllowsWidgetVariant("pro", "glow")).toBe(true)
    expect(planAllowsWidgetVariant("ultimate", "glow")).toBe(true)
    expect(planAllowsWidgetVariant("standard", "sleek")).toBe(true)
    expect(planAllowsWidgetVariant("pro", "sleek")).toBe(true)
  })

  it("keeps a widget the plan allows", () => {
    expect(clampWidgetVariantForPlan("standard", "glow")).toBe("glow")
    expect(clampWidgetVariantForPlan("standard", "sleek")).toBe("sleek")
    expect(clampWidgetVariantForPlan("free", "classic")).toBe("classic")
  })

  it("falls back to the first widget the plan allows", () => {
    // A domain that stored "glow" or "sleek" before the free plan excluded
    // it, or after a downgrade, must serve something the account still includes.
    expect(clampWidgetVariantForPlan("free", "glow")).toBe("classic")
    expect(clampWidgetVariantForPlan("free", "sleek")).toBe("classic")
  })

  it("falls back for a widget that does not exist", () => {
    expect(clampWidgetVariantForPlan("standard", "hologram")).toBe("classic")
    expect(clampWidgetVariantForPlan("standard", "")).toBe("classic")
  })
})
