import { describe, expect, it } from "vitest"

import { domainSlugSchema } from "@repo/api/domains/schemas"

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
