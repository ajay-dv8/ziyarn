import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createTeamService } from "@repo/api/workspaces/team-server";

/**
 * Minimal drizzle stand-in. Team rules are decided from the rows these queries
 * return, so each table is given a fixed row list.
 */
type TableRows = unknown[] | unknown[][];

function createFakeDb(results: Record<string, TableRows>) {
  const cursors = new Map<string, number>();

  const rowsFor = (table: unknown): unknown[] => {
    if (!table || typeof table !== "object") return [];
    const name = getTableName(table as never);
    const registered = results[name];
    if (!registered) return [];

    if (Array.isArray(registered[0])) {
      const queue = registered as unknown[][];
      const index = cursors.get(name) ?? 0;
      cursors.set(name, index + 1);
      return queue[index] ?? [];
    }

    return registered as unknown[];
  };

  const makeQuery = (rows: unknown[] = []) => {
    let current = rows;
    const proxy = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            return (
              onFulfilled: (value: unknown) => unknown,
              onRejected?: (reason: unknown) => unknown,
            ) => Promise.resolve(current).then(onFulfilled, onRejected);
          }
          if (
            prop === "from" ||
            prop === "update" ||
            prop === "insert" ||
            prop === "delete"
          ) {
            return (table: unknown) => {
              current = rowsFor(table);
              return proxy;
            };
          }
          return () => proxy;
        },
      },
    );
    return proxy;
  };

  return {
    select: () => makeQuery(),
    insert: (table: unknown) => makeQuery(rowsFor(table)),
    update: (table: unknown) => makeQuery(rowsFor(table)),
    delete: (table: unknown) => makeQuery(rowsFor(table)),
  };
}

const WORKSPACE_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const USER_ID = "user-1";

function serviceWith(
  results: Record<string, TableRows>,
  session: { user: { id: string; email: string } } | null = {
    user: { id: USER_ID, email: "owner@example.com" },
  },
) {
  return createTeamService({
    db: createFakeDb(results) as never,
    getSession: async () => session,
  });
}

describe("team service permissions", () => {
  it("refuses a plain workspace member creating a team", async () => {
    const service = serviceWith({
      workspaces: [[{ id: WORKSPACE_ID }]],
      workspace_members: [
        [{ workspaceId: WORKSPACE_ID, userId: USER_ID, role: "member" }],
      ],
    });

    await expect(
      service.createTeam(
        { name: "Support", workspaceId: WORKSPACE_ID },
        new Headers(),
      ),
    ).rejects.toThrow(
      expect.objectContaining({ status: 403, code: "ADMIN_REQUIRED" }),
    );
  });

  it("refuses a team beyond the workspace plan limit", async () => {
    const service = serviceWith({
      workspaces: [[{ id: WORKSPACE_ID }]],
      workspace_members: [
        [{ workspaceId: WORKSPACE_ID, userId: USER_ID, role: "admin" }],
      ],
      domains: [[{ plan: "free" }]],
      teams: [[{ teamCount: 1 }]],
    });

    await expect(
      service.createTeam(
        { name: "Support", workspaceId: WORKSPACE_ID },
        new Headers(),
      ),
    ).rejects.toThrow(
      expect.objectContaining({ status: 429, code: "PLAN_LIMIT_EXCEEDED" }),
    );
  });

  it("refuses an invite accepted by a different email", async () => {
    const service = serviceWith(
      {
        team_invites: [
          [
            {
              id: "invite-1",
              teamId: "team-1",
              email: "invited@example.com",
              role: "member",
              token: "token-1",
              invitedBy: "owner-1",
              expiresAt: new Date(Date.now() + 60_000),
            },
          ],
        ],
      },
      { user: { id: USER_ID, email: "someone-else@example.com" } },
    );

    await expect(
      service.acceptTeamInvite({ token: "token-1" }, new Headers()),
    ).rejects.toThrow(
      expect.objectContaining({ status: 403, code: "INVITE_EMAIL_MISMATCH" }),
    );
  });
});
