import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  prepareAccountDeletion,
} from "@repo/api/workspaces/account-deletion";

type TableRows = unknown[] | unknown[][];

/** Minimal drizzle stand-in: each table answers with its queued rows. */
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
    update: (table: unknown) => makeQuery(rowsFor(table)),
    insert: (table: unknown) => makeQuery(rowsFor(table)),
  };
}

const USER_ID = "user-1";

describe("account deletion", () => {
  it("blocks deletion while the user owns a workspace", async () => {
    const db = createFakeDb({
      workspaces: [[{ name: "Acme Support" }]],
      subscriptions: [[]],
    });

    await expect(
      prepareAccountDeletion(db as never, USER_ID),
    ).rejects.toThrow(
      expect.objectContaining({
        code: "ACCOUNT_DELETION_BLOCKED",
        message: expect.stringContaining("Transfer ownership of Acme Support"),
      }),
    );
  });

  it("blocks deletion while the subscription is active", async () => {
    const db = createFakeDb({
      workspaces: [[]],
      subscriptions: [[{ id: "subscription-1" }]],
    });

    await expect(
      prepareAccountDeletion(db as never, USER_ID),
    ).rejects.toThrow(
      expect.objectContaining({
        code: "ACCOUNT_DELETION_BLOCKED",
        message: expect.stringContaining("Cancel your subscription"),
      }),
    );
  });

  it("allows deletion when the user owns nothing shared", async () => {
    const db = createFakeDb({
      workspaces: [[]],
      subscriptions: [[]],
      teams: [[]],
    });

    await expect(
      prepareAccountDeletion(db as never, USER_ID),
    ).resolves.toBeUndefined();
  });

  it("hands an owned team to the workspace owner", async () => {
    const db = createFakeDb({
      workspaces: [[], [{ ownerId: "owner-2" }]],
      subscriptions: [[]],
      teams: [[{ id: "team-1", workspaceId: "ws-1" }]],
      team_members: [[]],
    });

    await expect(
      prepareAccountDeletion(db as never, USER_ID),
    ).resolves.toBeUndefined();
  });
});
