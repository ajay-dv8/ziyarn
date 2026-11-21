import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  findDomainAccess,
  findWorkspaceRole,
  roleCanEditDomainData,
} from "@repo/api/workspaces/access";

const DOMAIN_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "user-1";

const domainRow = {
  id: DOMAIN_ID,
  workspaceId: WORKSPACE_ID,
  ownerId: "creator-1",
  name: "Acme Support",
  slug: "acme",
};

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

describe("findDomainAccess", () => {
  it("grants a workspace member even when they did not create the domain", async () => {
    const db = createFakeDb({
      domains: [domainRow],
      workspace_members: [{ role: "member" }],
    });

    const access = await findDomainAccess(db as never, DOMAIN_ID, USER_ID);

    expect(access).toEqual({
      kind: "ok",
      domain: domainRow,
      role: "member",
    });
  });

  it("does not treat the creator as an implicit member", async () => {
    const db = createFakeDb({
      domains: [domainRow],
      workspace_members: [],
    });

    const access = await findDomainAccess(db as never, DOMAIN_ID, "creator-1");

    expect(access).toEqual({ kind: "forbidden" });
  });

  it("reports a missing domain separately from a missing membership", async () => {
    const db = createFakeDb({ domains: [] });

    await expect(
      findDomainAccess(db as never, DOMAIN_ID, USER_ID),
    ).resolves.toEqual({ kind: "not_found" });
  });
});

describe("findWorkspaceRole", () => {
  it("returns the membership role", async () => {
    const db = createFakeDb({ workspace_members: [{ role: "admin" }] });

    await expect(
      findWorkspaceRole(db as never, WORKSPACE_ID, USER_ID),
    ).resolves.toBe("admin");
  });

  it("returns null when the user is not a member", async () => {
    const db = createFakeDb({ workspace_members: [] });

    await expect(
      findWorkspaceRole(db as never, WORKSPACE_ID, USER_ID),
    ).resolves.toBeNull();
  });
});

describe("roleCanEditDomainData", () => {
  it("lets owners, admins, and members edit but keeps viewers read-only", () => {
    expect(roleCanEditDomainData("owner")).toBe(true);
    expect(roleCanEditDomainData("admin")).toBe(true);
    expect(roleCanEditDomainData("member")).toBe(true);
    expect(roleCanEditDomainData("viewer")).toBe(false);
  });
});
