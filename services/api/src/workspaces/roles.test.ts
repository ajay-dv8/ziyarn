import { describe, expect, it } from "vitest"

import {
  canEditWorkspace,
  canManageWorkspace,
} from "@repo/api/workspaces/roles"

describe("workspace integration roles", () => {
  it("lets only owners and admins manage connections", () => {
    expect(canManageWorkspace("owner")).toBe(true)
    expect(canManageWorkspace("admin")).toBe(true)
    expect(canManageWorkspace("member")).toBe(false)
    expect(canManageWorkspace("viewer")).toBe(false)
  })

  it("lets everyone except viewers change shared settings", () => {
    expect(canEditWorkspace("owner")).toBe(true)
    expect(canEditWorkspace("admin")).toBe(true)
    expect(canEditWorkspace("member")).toBe(true)
    expect(canEditWorkspace("viewer")).toBe(false)
  })
})
