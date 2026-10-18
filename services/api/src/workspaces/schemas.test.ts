import { describe, expect, it } from "vitest"

import {
  acceptInviteSchema,
  assignableWorkspaceRoleSchema,
  createWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  workspaceRoleSchema,
} from "@repo/api/workspaces/schemas"

describe("createWorkspaceSchema", () => {
  it("accepts a name", () => {
    const parsed = createWorkspaceSchema.safeParse({ name: "Acme Support" })
    expect(parsed.success).toBe(true)
  })

  it("trims the name", () => {
    const parsed = createWorkspaceSchema.parse({ name: "  Acme Support  " })
    expect(parsed.name).toBe("Acme Support")
  })

  it("refuses an empty or whitespace-only name", () => {
    expect(createWorkspaceSchema.safeParse({ name: "" }).success).toBe(false)
    expect(createWorkspaceSchema.safeParse({ name: "   " }).success).toBe(false)
  })

  it("refuses a name longer than 100 characters", () => {
    expect(
      createWorkspaceSchema.safeParse({ name: "x".repeat(101) }).success,
    ).toBe(false)
    expect(
      createWorkspaceSchema.safeParse({ name: "x".repeat(100) }).success,
    ).toBe(true)
  })
})

describe("inviteMemberSchema", () => {
  it("accepts an email and a role", () => {
    const parsed = inviteMemberSchema.safeParse({
      email: "teammate@example.com",
      role: "admin",
    })
    expect(parsed.success).toBe(true)
  })

  it("defaults the role to member", () => {
    const parsed = inviteMemberSchema.parse({ email: "teammate@example.com" })
    expect(parsed.role).toBe("member")
  })

  it("refuses an invalid email", () => {
    expect(
      inviteMemberSchema.safeParse({ email: "not-an-email" }).success,
    ).toBe(false)
  })

  it("refuses the owner role — a team has exactly one owner", () => {
    expect(
      inviteMemberSchema.safeParse({
        email: "teammate@example.com",
        role: "owner",
      }).success,
    ).toBe(false)
  })
})

describe("updateMemberRoleSchema", () => {
  it("accepts a member id and a role", () => {
    const parsed = updateMemberRoleSchema.safeParse({
      memberId: "0f8fad5b-d9cb-469f-a165-70867728950e",
      role: "viewer",
    })
    expect(parsed.success).toBe(true)
  })

  it("refuses a member id that is not a uuid", () => {
    expect(
      updateMemberRoleSchema.safeParse({ memberId: "nope", role: "viewer" })
        .success,
    ).toBe(false)
  })

  it("refuses the owner role", () => {
    expect(
      updateMemberRoleSchema.safeParse({
        memberId: "0f8fad5b-d9cb-469f-a165-70867728950e",
        role: "owner",
      }).success,
    ).toBe(false)
  })
})

describe("acceptInviteSchema", () => {
  it("accepts a token", () => {
    expect(acceptInviteSchema.safeParse({ token: "abc123" }).success).toBe(true)
  })

  it("refuses an empty token", () => {
    expect(acceptInviteSchema.safeParse({ token: "" }).success).toBe(false)
  })
})

describe("the role vocabulary", () => {
  it("knows every role a membership can hold", () => {
    for (const role of ["owner", "admin", "member", "viewer"]) {
      expect(workspaceRoleSchema.safeParse(role).success).toBe(true)
    }
  })

  it("knows only the assignable roles", () => {
    for (const role of ["admin", "member", "viewer"]) {
      expect(assignableWorkspaceRoleSchema.safeParse(role).success).toBe(true)
    }
    expect(assignableWorkspaceRoleSchema.safeParse("owner").success).toBe(false)
  })
})
