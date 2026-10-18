import { getTableName } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { createWorkspaceService, WorkspaceServiceError } from "@repo/api/workspaces/server"

/**
 * A drizzle stand-in.
 *
 * The workspace service's rules live in the queries it makes, not in the
 * queries themselves, so the tests only need to answer them. Every chain
 * resolves to the rows registered for the table it selected from.
 *
 * A table's rows may be given as a flat list — the same rows for every query
 * — or as a list of lists, in which case each query on that table takes the
 * next entry. The second form is what a service that asks the same table
 * twice needs: "is this person a member?" and then "who is this member?"
 */
type TableRows = unknown[] | unknown[][]

function createFakeDb(results: Record<string, TableRows>) {
  const cursors = new Map<string, number>()

  const rowsFor = (table: unknown): unknown[] => {
    if (!table || typeof table !== "object") return []
    const name = getTableName(table as never)
    const registered = results[name]
    if (!registered) return []

    if (Array.isArray(registered[0])) {
      const queue = registered as unknown[][]
      const index = cursors.get(name) ?? 0
      cursors.set(name, index + 1)
      return queue[index] ?? []
    }

    return registered as unknown[]
  }

  const makeQuery = (rows: unknown[] = []) => {
    let current = rows
    const proxy = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            return (
              onFulfilled: (value: unknown) => unknown,
              onRejected?: (reason: unknown) => unknown,
            ) => Promise.resolve(current).then(onFulfilled, onRejected)
          }
          if (prop === "from" || prop === "update" || prop === "insert" || prop === "delete") {
            return (table: unknown) => {
              current = rowsFor(table)
              return proxy
            }
          }
          // where, limit, values, set, innerJoin, orderBy … keep the chain going
          return () => proxy
        },
      },
    )
    return proxy
  }

  const api = {
    select: () => makeQuery(),
    insert: (table: unknown) => makeQuery(rowsFor(table)),
    update: (table: unknown) => makeQuery(rowsFor(table)),
    delete: (table: unknown) => makeQuery(rowsFor(table)),
    transaction: async (fn: (tx: unknown) => unknown) => fn(api),
  }

  return api
}

const OWNER_ID = "owner-1"
const MEMBER_ID = "member-1"
const ADMIN_ID = "admin-1"

/** A real uuid, because the service validates the member id before it looks
 * the member up. */
const TARGET_MEMBER_ID = "0f8fad5b-d9cb-469f-a165-70867728950e"

function membership(role: string, userId = OWNER_ID) {
  return { id: "membership-1", workspaceId: "ws-1", userId, role }
}

function serviceWith(
  results: Record<string, unknown[]>,
  session: { user: { id: string } } | null = { user: { id: OWNER_ID } },
) {
  return createWorkspaceService({
    db: createFakeDb(results) as never,
    getSession: async () => session,
  })
}

describe("workspace service permissions", () => {
  it("refuses a signed-out caller", async () => {
    const service = serviceWith({}, null)
    await expect(service.listMembers("ws-1", new Headers())).rejects.toThrow(
      expect.objectContaining({ status: 401, code: "UNAUTHORIZED" }),
    )
  })

  it("refuses a caller who is not a member", async () => {
    const service = serviceWith({ workspace_members: [] })
    await expect(service.listMembers("ws-1", new Headers())).rejects.toThrow(
      expect.objectContaining({ status: 403, code: "FORBIDDEN" }),
    )
  })

  it("refuses an invite from a plain member", async () => {
    const service = serviceWith({
      workspace_members: [[membership("member", MEMBER_ID)]],
      workspaces: [[{ id: "ws-1", name: "Acme Support", ownerId: OWNER_ID }]],
    })

    await expect(
      service.inviteMember(
        "ws-1",
        { email: "new@example.com", role: "member" },
        new Headers(),
      ),
    ).rejects.toThrow(
      expect.objectContaining({ status: 403, code: "FORBIDDEN" }),
    )
  })

  it("refuses a change to the owner's role", async () => {
    const service = serviceWith({
      workspace_members: [[membership("owner")], [membership("owner")]],
    })

    await expect(
      service.updateMemberRole(
        "ws-1",
        { memberId: TARGET_MEMBER_ID, role: "admin" },
        new Headers(),
      ),
    ).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "CANNOT_CHANGE_OWNER_ROLE" }),
    )
  })

  it("refuses the removal of the owner", async () => {
    const service = serviceWith({
      workspace_members: [[membership("owner")], [membership("owner")]],
    })

    await expect(
      service.removeMember("ws-1", "membership-1", new Headers()),
    ).rejects.toThrow(
      expect.objectContaining({ status: 400, code: "CANNOT_REMOVE_OWNER" }),
    )
  })

  it("lets an admin remove a member", async () => {
    const service = serviceWith({
      workspace_members: [
        [membership("admin")],
        [membership("member", MEMBER_ID)],
      ],
    })

    await expect(
      service.removeMember("ws-1", "membership-2", new Headers()),
    ).resolves.toBeUndefined()
  })

  it("stops an admin from removing a peer admin", async () => {
    const service = serviceWith({
      workspace_members: [
        [membership("admin")],
        [membership("admin", ADMIN_ID)],
      ],
    })

    await expect(
      service.removeMember("ws-1", "membership-2", new Headers()),
    ).rejects.toThrow(
      expect.objectContaining({ status: 403, code: "OWNER_REQUIRED" }),
    )
  })

  it("lets the owner remove an admin", async () => {
    const service = serviceWith({
      workspace_members: [
        [membership("owner")],
        [membership("admin", ADMIN_ID)],
      ],
    })

    await expect(
      service.removeMember("ws-1", "membership-2", new Headers()),
    ).resolves.toBeUndefined()
  })

  it("refuses a second team when the plan allows one", async () => {
    const service = serviceWith({
      // Two teams already, and the account is on the free plan.
      workspace_members: [
        [
          membership("owner", OWNER_ID),
          {
            id: "membership-2",
            workspaceId: "ws-2",
            userId: OWNER_ID,
            role: "owner",
          },
        ],
      ],
      domains: [[{ plan: "free" }]],
    })

    await expect(
      service.createWorkspace({ name: "Another Team" }, new Headers()),
    ).rejects.toThrow(
      expect.objectContaining({ status: 429, code: "PLAN_LIMIT_EXCEEDED" }),
    )
  })

  it("creates a team and makes the caller its owner", async () => {
    const service = serviceWith({
      workspace_members: [[]],
      domains: [[{ plan: "standard" }]],
      workspaces: [[{ id: "ws-new", name: "Acme Support", ownerId: OWNER_ID }]],
    })

    const created = await service.createWorkspace(
      { name: "Acme Support" },
      new Headers(),
    )
    expect(created.id).toBe("ws-new")
  })

  it("reports a missing team as not found", async () => {
    const service = serviceWith({
      workspace_members: [[membership("owner")]],
      workspaces: [[]],
    })

    await expect(
      service.getWorkspace("ws-1", new Headers()),
    ).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOT_FOUND" }),
    )
  })

  it("names the error type so callers can branch on it", () => {
    const error = new WorkspaceServiceError(403, "FORBIDDEN", "nope")
    expect(error).toBeInstanceOf(Error)
    expect(error.status).toBe(403)
    expect(error.code).toBe("FORBIDDEN")
  })
})
