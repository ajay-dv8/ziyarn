import { and, count, desc, eq, gt, isNull, lt } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  agents,
  conversations,
  domains,
  notifications,
  workspaces,
} from "@repo/database/schema";
import type { SessionWithUser } from "@repo/api/domains/server";

/** Notifications are delivery metadata, not an audit log. */
export const NOTIFICATION_RETENTION_DAYS = 30;

const NOTIFICATION_RETENTION_MS =
  NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export class NotificationServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "NotificationServiceError";
  }
}

const unauthorized = () =>
  new NotificationServiceError(401, "UNAUTHORIZED", "You must be signed in");

const notificationNotFound = () =>
  new NotificationServiceError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");

function truncate(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength)}…`
    : normalized;
}

export type ConversationEscalatedNotificationInput = {
  userId: string;
  workspaceId: string;
  domainId: string;
  conversationId: string;
  domainName: string;
  message?: string | null;
  reason?: string | null;
  /** Injectable for tests; callers should omit it. */
  now?: Date;
};

export function buildEscalationNotification(
  input: ConversationEscalatedNotificationInput,
) {
  const now = input.now ?? new Date();
  const snippet = input.message ? truncate(input.message, 160) : null;
  const reason = input.reason
    ? truncate(input.reason.replaceAll("_", " "), 120)
    : null;

  return {
    userId: input.userId,
    workspaceId: input.workspaceId,
    domainId: input.domainId,
    conversationId: input.conversationId,
    type: "conversation_escalated" as const,
    dedupeKey: `conversation_escalated:${input.conversationId}`,
    title: `New escalation in ${truncate(input.domainName, 100)}`,
    body: snippet
      ? `“${snippet}”`
      : reason
        ? `Reason: ${reason}`
        : "A visitor is waiting for a human agent.",
    readAt: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + NOTIFICATION_RETENTION_MS),
  };
}

/**
 * Creates or reopens the one notification row for a conversation escalation.
 * Repeated calls for the same episode update the same row instead of creating
 * duplicates.
 */
export async function notifyConversationEscalated(
  db: Database,
  input: ConversationEscalatedNotificationInput,
): Promise<void> {
  const values = buildEscalationNotification(input);

  await db
    .insert(notifications)
    .values(values)
    .onConflictDoUpdate({
      target: [notifications.userId, notifications.dedupeKey],
      set: {
        title: values.title,
        body: values.body,
        readAt: null,
        updatedAt: values.updatedAt,
        expiresAt: values.expiresAt,
      },
    });
}

/**
 * Repairs a missing row when a conversation is already escalated. It does not
 * reopen an existing read notification, so repeated tool calls cannot buzz the
 * owner again for the same episode.
 */
export async function ensureConversationEscalationNotification(
  db: Database,
  input: ConversationEscalatedNotificationInput,
): Promise<void> {
  await db
    .insert(notifications)
    .values(buildEscalationNotification(input))
    .onConflictDoNothing({
      target: [notifications.userId, notifications.dedupeKey],
    });
}

/** Marks every notification for one conversation as read for its owner. */
export async function markConversationNotificationsRead(
  db: Database,
  userId: string,
  conversationId: string,
): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.conversationId, conversationId),
        isNull(notifications.readAt),
      ),
    );
}

/** Called by the existing cron endpoint; returns the number of rows removed. */
export async function pruneExpiredNotifications(
  db: Database,
  now: Date = new Date(),
): Promise<number> {
  const deleted = await db
    .delete(notifications)
    .where(lt(notifications.expiresAt, now))
    .returning({ id: notifications.id });

  return deleted.length;
}

export type NotificationSummary = {
  unreadNotificationCount: number;
  openEscalatedCount: number;
  latestNotification: {
    id: string;
    type: "conversation_escalated";
    title: string;
    body: string;
    workspaceId: string;
    conversationId: string | null;
    updatedAt: Date;
  } | null;
};

export type NotificationListRow = {
  id: string;
  type: "conversation_escalated";
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  workspaceId: string;
  workspaceName: string;
  domainId: string | null;
  domainName: string | null;
  conversationId: string | null;
};

export type NotificationReadTarget = {
  workspaceId: string;
  conversationId: string | null;
};

/**
 * Session-scoped notification reads. Ownership is always the session user; no
 * caller-supplied user id is accepted.
 */
export function createNotificationsService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
}) {
  const { db, getSession } = deps;

  const requireSession = async (headers: Headers) => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();
    return session.user;
  };

  return {
    summary: async (
      headers: Headers,
      activeWorkspaceId: string | null,
    ): Promise<NotificationSummary> => {
      const user = await requireSession(headers);
      const now = new Date();

      const [unreadRows, latestRows, escalatedRows] = await Promise.all([
        db
          .select({ total: count() })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, user.id),
              isNull(notifications.readAt),
              gt(notifications.expiresAt, now),
            ),
          ),
        db
          .select({
            id: notifications.id,
            type: notifications.type,
            title: notifications.title,
            body: notifications.body,
            workspaceId: notifications.workspaceId,
            conversationId: notifications.conversationId,
            updatedAt: notifications.updatedAt,
          })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, user.id),
              gt(notifications.expiresAt, now),
            ),
          )
          .orderBy(desc(notifications.updatedAt))
          .limit(1),
        activeWorkspaceId
          ? db
              .select({ total: count() })
              .from(conversations)
              .innerJoin(agents, eq(conversations.agentId, agents.id))
              .innerJoin(domains, eq(agents.domainId, domains.id))
              .where(
                and(
                  eq(domains.workspaceId, activeWorkspaceId),
                  eq(conversations.status, "escalated"),
                ),
              )
          : Promise.resolve([{ total: 0 }]),
      ]);

      return {
        unreadNotificationCount: Number(unreadRows[0]?.total ?? 0),
        openEscalatedCount: Number(escalatedRows[0]?.total ?? 0),
        latestNotification: latestRows[0] ?? null,
      };
    },

    list: async (
      headers: Headers,
      limit = 30,
    ): Promise<NotificationListRow[]> => {
      const user = await requireSession(headers);
      const now = new Date();
      const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);

      return db
        .select({
          id: notifications.id,
          type: notifications.type,
          title: notifications.title,
          body: notifications.body,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
          updatedAt: notifications.updatedAt,
          workspaceId: notifications.workspaceId,
          workspaceName: workspaces.name,
          domainId: notifications.domainId,
          domainName: domains.name,
          conversationId: notifications.conversationId,
        })
        .from(notifications)
        .innerJoin(workspaces, eq(notifications.workspaceId, workspaces.id))
        .leftJoin(domains, eq(notifications.domainId, domains.id))
        .where(
          and(
            eq(notifications.userId, user.id),
            gt(notifications.expiresAt, now),
          ),
        )
        .orderBy(desc(notifications.updatedAt))
        .limit(safeLimit);
    },

    markRead: async (
      headers: Headers,
      notificationId: string,
    ): Promise<NotificationReadTarget> => {
      const user = await requireSession(headers);
      const now = new Date();
      const [updated] = await db
        .update(notifications)
        .set({ readAt: now })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, user.id),
            gt(notifications.expiresAt, now),
          ),
        )
        .returning({
          workspaceId: notifications.workspaceId,
          conversationId: notifications.conversationId,
        });

      if (!updated) throw notificationNotFound();
      return updated;
    },

    markAllRead: async (headers: Headers): Promise<number> => {
      const user = await requireSession(headers);
      const now = new Date();
      const updated = await db
        .update(notifications)
        .set({ readAt: now })
        .where(
          and(
            eq(notifications.userId, user.id),
            isNull(notifications.readAt),
            gt(notifications.expiresAt, now),
          ),
        )
        .returning({ id: notifications.id });

      return updated.length;
    },
  };
}
