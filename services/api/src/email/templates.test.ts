import { describe, expect, it } from "vitest"

import { workspaceInviteTemplate } from "@repo/api/email/templates"

describe("workspaceInviteTemplate", () => {
  const input = {
    workspaceName: "Acme Support",
    roleLabel: "Member",
    inviteUrl: "https://ziyarn.vercel.app/accept-invite?token=abc123",
    expiresAt: "2026-10-24T19:34:36.000Z",
  }

  it("names the team, the role and the link", () => {
    const message = workspaceInviteTemplate(input)
    expect(message.subject).toContain("Acme Support")
    expect(message.text).toContain("Acme Support")
    expect(message.text).toContain("Member")
    expect(message.text).toContain(input.inviteUrl)
    expect(message.html).toContain(input.inviteUrl)
  })

  it("states when the invite expires", () => {
    const message = workspaceInviteTemplate(input)
    expect(message.text).toContain("24 Oct 2026")
  })

  it("escapes a name that would break the markup", () => {
    const message = workspaceInviteTemplate({
      ...input,
      workspaceName: 'Acme <script>alert("x")</script>',
    })
    expect(message.html).not.toContain("<script>")
    expect(message.html).toContain("&lt;script&gt;")
  })

  it("has no unsubscribe footer — the recipient asked to join", () => {
    const message = workspaceInviteTemplate(input)
    expect(message.text).not.toContain("unsubscribe")
    expect(message.html).not.toContain("unsubscribe")
  })
})
