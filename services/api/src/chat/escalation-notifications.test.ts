import { getTableName } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { escalateConversationToHuman, type ChatService } from "@repo/api/chat/server";
import { sendTransactional } from "@repo/api/email/server";
import {
  ensureConversationEscalationNotification,
  notifyConversationEscalated,
} from "@repo/api/notifications/server";

vi.mock("@repo/api/notifications/server", () => ({
  notifyConversationEscalated: vi.fn(),
  ensureConversationEscalationNotification: vi.fn(),
  markConversationNotificationsRead: vi.fn(),
}));

vi.mock("@repo/api/email/server", () => ({
  sendTransactional: vi.fn(),
}));

const OWNER_ID = "owner-1";
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const DOMAIN_ID = "22222222-2222-4222-8222-222222222222";
const CONVERSATION_ID = "33333333-3333-4333-8333-333333333333";

function createFakeDb(rowsByTable: Record<string, unknown[]>) {
  return {
    select: () => ({
      from: (table: unknown) => {
        const rows = rowsByTable[getTableName(table as never)] ?? [];
        const query = {
          where: () => query,
          orderBy: () => query,
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

function deps(status: "active" | "escalated" = "active") {
  const setConversationStatus = vi.fn(async () => ({}));
  const logger = { info: vi.fn(), error: vi.fn() };
  const db = createFakeDb({
    conversations: [{ status }],
    domains: [
      {
        ownerId: OWNER_ID,
        workspaceId: WORKSPACE_ID,
        domainName: "Acme Support",
      },
    ],
    messages: [{ content: "Where is my order?" }],
    workspace_members: [{ userId: OWNER_ID }],
    workspaces: [{ ownerId: OWNER_ID }],
    user: [{ email: "owner@example.com" }],
  });

  return {
    db,
    logger,
    setConversationStatus,
    deps: {
      db: db as never,
      domain: { id: DOMAIN_ID, slug: "acme" },
      conversationId: CONVERSATION_ID,
      chatService: { setConversationStatus } as unknown as ChatService,
      logger: logger as never,
      reason: "model_unavailable",
    },
  };
}

describe("escalation notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a notification and emails the authenticated owner once", async () => {
    const { deps: escalationDeps, setConversationStatus } = deps();

    await escalateConversationToHuman(escalationDeps);

    expect(setConversationStatus).toHaveBeenCalledWith(
      CONVERSATION_ID,
      "escalated",
    );
    expect(notifyConversationEscalated).toHaveBeenCalledWith(
      escalationDeps.db,
      expect.objectContaining({
        userId: OWNER_ID,
        workspaceId: WORKSPACE_ID,
        domainId: DOMAIN_ID,
        conversationId: CONVERSATION_ID,
        domainName: "Acme Support",
        message: "Where is my order?",
        reason: "model_unavailable",
      }),
    );
    expect(sendTransactional).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.com" }),
    );
    expect(ensureConversationEscalationNotification).not.toHaveBeenCalled();
  });

  it("repairs a missing notification without a second email or reopen", async () => {
    const { deps: escalationDeps } = deps("escalated");

    await escalateConversationToHuman(escalationDeps);

    expect(ensureConversationEscalationNotification).toHaveBeenCalledTimes(1);
    expect(notifyConversationEscalated).not.toHaveBeenCalled();
    expect(sendTransactional).not.toHaveBeenCalled();
  });

  it("still sends the email when notification storage fails", async () => {
    vi.mocked(notifyConversationEscalated).mockRejectedValueOnce(
      new Error("notification insert failed"),
    );
    const { deps: escalationDeps, logger } = deps();

    await expect(
      escalateConversationToHuman(escalationDeps),
    ).resolves.toBeUndefined();

    expect(sendTransactional).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: CONVERSATION_ID }),
      "escalation_notification_failed",
    );
  });

  it("keeps the notification when email delivery fails", async () => {
    vi.mocked(sendTransactional).mockRejectedValueOnce(
      new Error("smtp unavailable"),
    );
    const { deps: escalationDeps, logger } = deps();

    await expect(
      escalateConversationToHuman(escalationDeps),
    ).resolves.toBeUndefined();

    expect(notifyConversationEscalated).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: CONVERSATION_ID }),
      "escalation_email_failed",
    );
  });
});
