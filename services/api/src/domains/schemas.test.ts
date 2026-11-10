import { describe, expect, it } from "vitest"

import {
  domainSlugSchema,
  updateDomainSchema,
} from "@repo/api/domains/schemas"

describe("domainSlugSchema", () => {
  it("trims and lowercases a slug", () => {
    expect(domainSlugSchema.parse("  Urban-Plus-2  ")).toBe("urban-plus-2")
  })

  it("accepts 3-63 lowercase letters, digits and hyphens", () => {
    expect(domainSlugSchema.safeParse("acme").success).toBe(true)
    expect(domainSlugSchema.safeParse("a".repeat(63)).success).toBe(true)
  })

  it("refuses slugs shorter than 3 characters", () => {
    expect(domainSlugSchema.safeParse("ab").success).toBe(false)
  })

  it("refuses slugs longer than 63 characters", () => {
    expect(domainSlugSchema.safeParse("a".repeat(64)).success).toBe(false)
  })

  it("refuses spaces, underscores and edge hyphens", () => {
    for (const value of ["acme helpdesk", "acme_helpdesk", "-acme", "acme-"]) {
      expect(domainSlugSchema.safeParse(value).success).toBe(false)
    }
  })
})

describe("updateDomainSchema — chat trigger", () => {
  it("accepts a trigger id and a config bag", () => {
    const parsed = updateDomainSchema.safeParse({
      chatTrigger: "pill",
      chatTriggerConfig: { label: "Chat with us", tooltip: "Chat with us" },
    })
    expect(parsed.success).toBe(true)
  })

  it("accepts an id with no config", () => {
    expect(updateDomainSchema.safeParse({ chatTrigger: "orb" }).success).toBe(
      true,
    )
  })

  it("refuses an unregistered trigger id", () => {
    expect(
      updateDomainSchema.safeParse({ chatTrigger: "hologram" }).success,
    ).toBe(false)
  })

  it("refuses unknown config keys", () => {
    expect(
      updateDomainSchema.safeParse({
        chatTrigger: "bubble",
        chatTriggerConfig: { animation: "wobble" },
      }).success,
    ).toBe(false)
  })

  it("still refuses payloads that change nothing", () => {
    expect(updateDomainSchema.safeParse({}).success).toBe(false)
  })
})
