import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  applyPlanToOwnedWorkspaces,
  resolveUserPlan,
  resolveWorkspacePlan,
} from "@repo/api/workspaces/plan";

const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "owner-1";

function createFakeDb(rowsByTable: Record<string, unknown[]>) {
  return {
    select: () => ({
      from: (table: unknown) => {
        const rows = rowsByTable[getTableName(table as never)] ?? [];
        const query = {
          where: () => query,
          limit: () => query,
          then: (
            onFulfilled: (value: unknown) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => Promise.resolve(rows).then(onFulfilled, onRejected),
        };
        return query;
      },
    }),
  };
}

describe("resolveWorkspacePlan", () => {
  it("uses the workspace owner's active subscription", async () => {
    const db = createFakeDb({
      workspaces: [{ ownerId: OWNER_ID }],
      subscriptions: [{ plan: "ultimate", status: "active" }],
    });

    await expect(resolveWorkspacePlan(db as never, WORKSPACE_ID)).resolves.toBe(
      "ultimate",
    );
  });

  it("falls back to free when the owner's subscription is canceled", async () => {
    const db = createFakeDb({
      workspaces: [{ ownerId: OWNER_ID }],
      subscriptions: [{ plan: "pro", status: "canceled" }],
    });

    await expect(resolveWorkspacePlan(db as never, WORKSPACE_ID)).resolves.toBe(
      "free",
    );
  });

  it("treats a missing workspace as free", async () => {
    const db = createFakeDb({ workspaces: [] });

    await expect(resolveWorkspacePlan(db as never, WORKSPACE_ID)).resolves.toBe(
      "free",
    );
  });
});

describe("resolveUserPlan", () => {
  it("reads the user's own subscription, not a domain cache", async () => {
    const db = createFakeDb({
      subscriptions: [{ plan: "standard", status: "trialing" }],
    });

    await expect(resolveUserPlan(db as never, OWNER_ID)).resolves.toBe(
      "standard",
    );
  });
});

describe("applyPlanToOwnedWorkspaces", () => {
  it("updates domains in all workspaces the subscriber owns", async () => {
    const updates: Array<{ table: string; values: unknown }> = [];
    const db = {
      select: () => ({
        from: () => ({
          where: () =>
            Promise.resolve([{ id: "workspace-1" }, { id: "workspace-2" }]),
        }),
      }),
      update: (table: unknown) => ({
        set: (values: unknown) => {
          updates.push({ table: getTableName(table as never), values });
          return { where: () => Promise.resolve() };
        },
      }),
    };

    await applyPlanToOwnedWorkspaces(db as never, OWNER_ID, "ultimate");

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      table: "domains",
      values: { plan: "ultimate" },
    });
  });

  it("does not touch domains when the subscriber owns no workspace", async () => {
    const updates: unknown[] = [];
    const db = {
      select: () => ({
        from: () => ({ where: () => Promise.resolve([]) }),
      }),
      update: () => {
        updates.push("unexpected update");
        return { set: () => ({ where: () => Promise.resolve() }) };
      },
    };

    await applyPlanToOwnedWorkspaces(db as never, OWNER_ID, "free");

    expect(updates).toEqual([]);
  });
});
