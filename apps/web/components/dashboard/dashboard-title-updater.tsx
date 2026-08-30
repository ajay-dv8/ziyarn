"use client";

import { useEffect } from "react";

import { useUnreadCount } from "@/hooks/use-unread-count";

const BASE_TITLE = "Ziyarn";

/**
 * Updates the browser tab title to show unread count when the tab is not focused.
 * Renders nothing — side-effect only.
 */
export function DashboardTitleUpdater() {
  const totalUnread = useUnreadCount();

  useEffect(() => {
    if (totalUnread > 0 && document.hidden) {
      document.title = `(${totalUnread}) ${BASE_TITLE}`;
    } else {
      document.title = BASE_TITLE;
    }
  }, [totalUnread]);

  // Reset title when tab becomes visible
  useEffect(() => {
    function handleVisibilityChange() {
      if (!document.hidden) {
        document.title = BASE_TITLE;
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
