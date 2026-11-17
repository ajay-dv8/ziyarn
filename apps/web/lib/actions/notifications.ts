"use server";

import { headers } from "next/headers";

import {
  NotificationServiceError,
  type NotificationListRow,
  type NotificationSummary,
} from "@repo/api/notifications";
import { notificationIdSchema } from "@repo/api/notifications/schemas";
import { resolveActiveWorkspaceId } from "@repo/api/workspaces/active";
import { db } from "@repo/database";

import { authService } from "@/services/auth-service";
import { notificationsService } from "@/services/notifications-service";

export type NotificationActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type NotificationSummaryView = Omit<
  NotificationSummary,
  "latestNotification"
> & {
  latestNotification:
    | (Omit<NonNullable<NotificationSummary["latestNotification"]>, "updatedAt"> & {
        updatedAt: string;
      })
    | null;
};

export type NotificationListView = Omit<
  NotificationListRow,
  "readAt" | "createdAt" | "updatedAt"
> & {
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
};

async function requireUser() {
  const session = await authService.getSession(await headers());
  if (!session?.user) {
    throw new NotificationServiceError(401, "UNAUTHORIZED", "Not signed in");
  }
  return session.user;
}

function errorResult(error: unknown): Extract<NotificationActionResult, { ok: false }> {
  if (error instanceof NotificationServiceError) {
    return { ok: false, error: error.message };
  }
  console.error("Unexpected notification action error:", error);
  return { ok: false, error: "Something went wrong, please try again" };
}

export async function getNotificationSummaryAction(): Promise<
  NotificationActionResult & { summary?: NotificationSummaryView }
> {
  try {
    const requestHeaders = await headers();
    const user = await requireUser();
    const activeWorkspaceId = await resolveActiveWorkspaceId(
      db,
      requestHeaders,
      user.id,
    );
    const summary = await notificationsService.summary(
      requestHeaders,
      activeWorkspaceId,
    );

    return {
      ok: true,
      summary: {
        ...summary,
        latestNotification: summary.latestNotification
          ? {
              ...summary.latestNotification,
              updatedAt: summary.latestNotification.updatedAt.toISOString(),
            }
          : null,
      },
    };
  } catch (error) {
    return errorResult(error);
  }
}

export async function listNotificationsAction(): Promise<
  NotificationActionResult & { notifications?: NotificationListView[] }
> {
  try {
    const rows = await notificationsService.list(await headers());
    return {
      ok: true,
      notifications: rows.map((row) => ({
        ...row,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  } catch (error) {
    return errorResult(error);
  }
}

export async function markNotificationReadAction(input: {
  id: string;
}): Promise<
  NotificationActionResult & {
    workspaceId?: string;
    conversationId?: string | null;
  }
> {
  const parsed = notificationIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid notification" };
  }

  try {
    const target = await notificationsService.markRead(
      await headers(),
      parsed.data.id,
    );
    return {
      ok: true,
      workspaceId: target.workspaceId,
      conversationId: target.conversationId,
    };
  } catch (error) {
    return errorResult(error);
  }
}

export async function markAllNotificationsReadAction(): Promise<
  NotificationActionResult & { count?: number }
> {
  try {
    const count = await notificationsService.markAllRead(await headers());
    return { ok: true, count };
  } catch (error) {
    return errorResult(error);
  }
}
