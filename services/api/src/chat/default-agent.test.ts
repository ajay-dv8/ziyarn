import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { createChatService } from "@repo/api/chat/server";

type FakeQuery = {
  from: (table: unknown) => FakeQuery;
  where: () => FakeQuery;
  orderBy: () => FakeQuery;
  limit: () => Promise<unknown[]>;
};

function createFakeDb(rowsByTable: Record<string, unknown[]>) {
  return {
    select() {
      let tableName = "";
      const query: FakeQuery = {
        from(table) {
          tableName = getTableName(table as never);
          return query;
        },
        where() {
          return query;
        },
        orderBy() {
          return query;
        },
        limit() {
          return Promise.resolve(rowsByTable[tableName] ?? []);
        },
      };
      return query;
    },
  } as never;
}

describe("defaultAgentForDomain", () => {
  it("uses the explicitly chosen widget agent", async () => {
    const chatService = createChatService({
      db: createFakeDb({
        domain_agent_defaults: [{ agentId: "agent-2" }],
        agents: [{ id: "agent-2", name: "Chosen" }],
      }),
    });

    await expect(chatService.defaultAgentForDomain("domain-1")).resolves.toMatchObject(
      { id: "agent-2" },
    );
  });

  it("falls back to the oldest agent when no choice is stored", async () => {
    const chatService = createChatService({
      db: createFakeDb({
        domain_agent_defaults: [],
        agents: [{ id: "agent-1", name: "Oldest" }],
      }),
    });

    await expect(chatService.defaultAgentForDomain("domain-1")).resolves.toMatchObject(
      { id: "agent-1" },
    );
  });
});
