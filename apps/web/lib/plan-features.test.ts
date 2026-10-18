import { describe, expect, it } from "vitest"

import { planFeatures } from "@/lib/plan-features"

describe("planFeatures", () => {
  it("gives every plan the same rows, so two cards can be read together", () => {
    const free = planFeatures("free")
    const plus = planFeatures("standard")
    const business = planFeatures("pro")
    const enterprise = planFeatures("ultimate")

    expect(free.length).toBe(plus.length)
    expect(plus.length).toBe(business.length)
    expect(business.length).toBe(enterprise.length)
  })

  it("shows the free plan's limits, and strikes what it does not have", () => {
    const free = planFeatures("free")
    const byLabel = Object.fromEntries(
      free.map((feature) => [feature.label, feature.included]),
    )

    expect(byLabel["1 domain"]).toBe(true)
    expect(byLabel["100 AI credits / month"]).toBe(true)
    expect(byLabel["Marketing emails"]).toBe(false)
    expect(byLabel["Catalog products"]).toBe(false)
    expect(byLabel["Choose your widget"]).toBe(false)
  })

  it("shows each plan's own numbers", () => {
    const plus = planFeatures("standard")
    const labels = plus.map((feature) => feature.label)

    expect(labels).toContain("3 domains")
    expect(labels).toContain("200 AI credits / month")
    expect(labels).toContain("500 emails / month")
    expect(labels).toContain("100 products per domain")
  })

  it("offers the widget choice on every paid plan that lists limits", () => {
    for (const plan of ["standard", "pro", "ultimate"] as const) {
      const widget = planFeatures(plan).find(
        (feature) => feature.label === "Choose your widget",
      )
      expect(widget?.included).toBe(true)
    }
  })

  it("gives Custom its own rows rather than a wall of unlimited limits", () => {
    const custom = planFeatures("custom")

    expect(custom.map((feature) => feature.label)).toEqual([
      "Everything in Enterprise",
      "Unlimited emails / month",
      "Dedicated development support",
    ])
    expect(custom.every((feature) => feature.included)).toBe(true)
  })

  it("says unlimited rather than Infinity", () => {
    const enterprise = planFeatures("ultimate")
    expect(enterprise.map((feature) => feature.label)).toContain(
      "Unlimited team members",
    )
  })
})
