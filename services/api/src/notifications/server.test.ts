import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  buildEscalationNotification,
  createNotificationsService,
  ensureConversationEscalationNotification,
  notifyConversationEscalated,
  pruneExpiredNotifications,
} from "@repo/api/notifications/server";

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

const OWNER_ID = "owner-1";
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const DOMAIN_ID = "22222222-2222-4222-8222-222222222222";
const CONVERSATION_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-11-17T12:00:00.000Z");

function serviceWith(
  results: Record<string, TableRows>,
  session: { user: { id: string } } | null = { user: { id: OWNER_ID } },
) {
  return createNotificationsService({
    db: createFakeDb(results) as never,
    getSession: async () => session as never,
  });
}

describe("escalation notification content", () => {
  it("builds one deduped notification with a 30-day expiry", () => {
    const notification = buildEscalationNotification({
      userId: OWNER_ID,
      workspaceId: WORKSPACE_ID,
      domainId: DOMAIN_ID,
      conversationId: CONVERSATION_ID,
      domainName: "Acme Support",
      message: "  Where is my order?\nIt is late.  ",
      now: NOW,
    });

    expect(notification.dedupeKey).toBe(
      `conversation_escalated:${CONVERSATION_ID}`,
    );
    expect(notification.title).toBe("New escalation in Acme Support");
    expect(notification.body).toBe("“Where is my order? It is late.”");
    expect(notification.readAt).toBeNull();
    expect(notification.expiresAt.toISOString()).toBe(
      "2026-12-17T12:00:00.000Z",
    );
  });

  it("falls back to the reason when there is no visitor message", () => {
    const notification = buildEscalationNotification({
      userId: OWNER_ID,
      workspaceId: WORKSPACE_ID,
      domainId: DOMAIN_ID,
      conversationId: CONVERSATION_ID,
      domainName: "Acme Support",
      reason: "model_unavailable",
      now: NOW,
    });

    expect(notification.body).toBe("Reason: model unavailable");
  });
});

describe("notification writes", () => {
  it("reopens an existing deduped row as unread", async () => {
    let values: Record<string, unknown> | undefined;
    let conflict: Record<string, unknown> | undefined;
    const db = {
      insert: () => ({
        values: (nextValues: Record<string, unknown>) => {
          values = nextValues;
          return {
            onConflictDoUpdate: async (options: Record<string, unknown>) => {
              conflict = options;
            },
          };
        },
      }),
    };

    await notifyConversationEscalated(db as never, {
      userId: OWNER_ID,
      workspaceId: WORKSPACE_ID,
      domainId: DOMAIN_ID,
      conversationId: CONVERSATION_ID,
      domainName: "Acme Support",
      message: "Hello",
      now: NOW,
    });

    expect(values?.readAt).toBeNull();
    expect(values?.dedupeKey).toBe(
      `conversation_escalated:${CONVERSATION_ID}`,
    );
    expect(conflict?.target).toEqual([
      expect.anything(),
      expect.anything(),
    ]);
    expect(conflict?.set).toMatchObject({ readAt: null });
  });

  it("does not reopen a read row for a repeated escalation", async () => {
    let conflictMethod = "";
    const db = {
      insert: () => ({
        values: () => ({
          onConflictDoNothing: async () => {
            conflictMethod = "do-nothing";
          },
          onConflictDoUpdate: async () => {
            conflictMethod = "do-update";
          },
        }),
      }),
    };

    await ensureConversationEscalationNotification(db as never, {
      userId: OWNER_ID,
      workspaceId: WORKSPACE_ID,
      domainId: DOMAIN_ID,
      conversationId: CONVERSATION_ID,
      domainName: "Acme Support",
      now: NOW,
    });

    expect(conflictMethod).toBe("do-nothing");
  });

  it("returns the number of expired rows pruned", async () => {
    const db = createFakeDb({
      notifications: [[{ id: "notification-1" }, { id: "notification-2" }]],
    });

    await expect(pruneExpiredNotifications(db as never, NOW)).resolves.toBe(2);
  });
});

describe("notifications service", () => {
  it("refuses a signed-out caller", async () => {
    const service = serviceWith({}, null);
    await expect(service.summary(new Headers(), WORKSPACE_ID)).rejects.toThrow(
      expect.objectContaining({ status: 401, code: "UNAUTHORIZED" }),
    );
  });

  it("returns unread, open-escalated and latest notification state", async () => {
    const latestNotification = {
      id: "notification-1",
      type: "conversation_escalated",
      title: "New escalation in Acme Support",
      body: "“Where is my order?”",
      workspaceId: WORKSPACE_ID,
      conversationId: CONVERSATION_ID,
      updatedAt: NOW,
    };
    const service = serviceWith({
      notifications: [[{ total: 4 }], [latestNotification]],
      conversations: [[{ total: 2 }]],
    });

    const summary = await service.summary(new Headers(), WORKSPACE_ID);

    expect(summary.unreadNotificationCount).toBe(4);
    expect(summary.openEscalatedCount).toBe(2);
    expect(summary.latestNotification).toEqual(latestNotification);
  });

  it("does not query conversations when there is no active workspace", async () => {
    const service = serviceWith({
      notifications: [[{ total: 0 }], []],
    });

    const summary = await service.summary(new Headers(), null);

    expect(summary.openEscalatedCount).toBe(0);
    expect(summary.latestNotification).toBeNull();
  });

  it("marks one notification read and returns its navigation target", async () => {
    const service = serviceWith({
      notifications: [[{ workspaceId: WORKSPACE_ID, conversationId: CONVERSATION_ID }]],
    });

    await expect(
      service.markRead(new Headers(), "notification-1"),
    ).resolves.toEqual({
      workspaceId: WORKSPACE_ID,
      conversationId: CONVERSATION_ID,
    });
  });

  it("refuses to mark an unknown notification read", async () => {
    const service = serviceWith({ notifications: [[]] });

    await expect(
      service.markRead(new Headers(), "notification-1"),
    ).rejects.toThrow(
      expect.objectContaining({ status: 404, code: "NOTIFICATION_NOT_FOUND" }),
    );
  });

  it("marks all unread notifications read", async () => {
    const service = serviceWith({
      notifications: [[{ id: "notification-1" }, { id: "notification-2" }]],
    });

    await expect(service.markAllRead(new Headers())).resolves.toBe(2);
  });

  it("lists notifications with workspace and domain labels", async () => {
    const service = serviceWith({
      notifications: [
        [
          {
            id: "notification-1",
            type: "conversation_escalated",
            title: "New escalation in Acme Support",
            body: "“Where is my order?”",
            readAt: null,
            createdAt: NOW,
            updatedAt: NOW,
            workspaceId: WORKSPACE_ID,
            workspaceName: "Acme Workspace",
            domainId: DOMAIN_ID,
            domainName: "Acme Support",
            conversationId: CONVERSATION_ID,
          },
        ],
      ],
    });

    const notifications = await service.list(new Headers());

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      workspaceName: "Acme Workspace",
      domainName: "Acme Support",
      conversationId: CONVERSATION_ID,
    });
  });
});
