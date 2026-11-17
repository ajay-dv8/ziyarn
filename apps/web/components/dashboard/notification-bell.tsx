"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, Loader2, MessagesSquare } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@repo/ui/components/button";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";
import { cn } from "@repo/ui/lib/utils";

import { APP_ROUTES } from "@/constants/routes";
import {
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationListView,
} from "@/lib/actions/notifications";
import { setActiveWorkspaceCookie } from "@/lib/active-workspace";
import { formatRelativeTime } from "@/lib/utils";
import {
  refreshNotificationSummary,
  useNotificationSummary,
} from "@/hooks/use-notification-summary";

function conversationUrl(conversationId: string): string {
  return `${APP_ROUTES.DASHBOARD_CONVERSATIONS}?conversationId=${encodeURIComponent(
    conversationId,
  )}`;
}

export function NotificationBell() {
  const summary = useNotificationSummary();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationListView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadCount = summary.unreadNotificationCount;
  const latestMarker = summary.latestNotification
    ? `${summary.latestNotification.id}:${summary.latestNotification.updatedAt}`
    : "none";

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const result = await listNotificationsAction();
    if (result.ok && result.notifications) {
      setNotifications(result.notifications);
      setError(null);
    } else {
      setError(result.ok ? "Could not load notifications" : result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) void loadNotifications();
  }, [open, latestMarker, loadNotifications]);

  async function openNotification(notification: NotificationListView) {
    const result = await markNotificationReadAction({ id: notification.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (!result.workspaceId || !result.conversationId) {
      toast.error("This notification has no conversation to open");
      return;
    }

    setActiveWorkspaceCookie(result.workspaceId);
    setOpen(false);
    refreshNotificationSummary();
    // A full navigation guarantees the server sees the workspace cookie that
    // was just written, so the conversation page and sidebar stay in sync.
    window.location.assign(conversationUrl(result.conversationId));
  }

  async function markAllRead() {
    const result = await markAllNotificationsReadAction();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? new Date().toISOString(),
      })),
    );
    refreshNotificationSummary();
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        onClick={() => setOpen(true)}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium tabular-nums text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-4 py-3">
            <div className="flex items-start justify-between gap-3 pr-8">
              <div className="space-y-0.5">
                <SheetTitle>Notifications</SheetTitle>
                <SheetDescription>
                  Escalations and updates from your workspaces.
                </SheetDescription>
              </div>
              {unreadCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={markAllRead}
                >
                  <CheckCheck />
                  Mark all read
                </Button>
              )}
            </div>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading notifications…
              </div>
            ) : error ? (
              <p className="p-4 text-sm text-destructive">{error}</p>
            ) : notifications.length === 0 ? (
              <div className="space-y-1 p-8 text-center">
                <Bell className="mx-auto size-5 text-muted-foreground" />
                <p className="text-sm font-medium">You&apos;re all caught up</p>
                <p className="text-xs text-muted-foreground">
                  New escalations will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {notifications.map((notification) => (
                  <li key={notification.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                        !notification.readAt && "bg-muted/30",
                      )}
                      onClick={() => void openNotification(notification)}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border",
                          notification.readAt
                            ? "text-muted-foreground"
                            : "border-destructive/30 bg-destructive/10 text-destructive",
                        )}
                      >
                        <MessagesSquare className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span
                            className={cn(
                              "min-w-0 flex-1 text-sm",
                              notification.readAt
                                ? "font-normal text-muted-foreground"
                                : "font-medium",
                            )}
                          >
                            {notification.title}
                          </span>
                          {!notification.readAt && (
                            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-destructive" />
                          )}
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                          {notification.body}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {notification.workspaceName}
                          {notification.domainName
                            ? ` · ${notification.domainName}`
                            : ""}
                          {" · "}
                          {formatRelativeTime(notification.updatedAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
