"use client";

import { useEffect } from "react";

import { useNotificationSummary } from "@/hooks/use-notification-summary";

const BASE_TITLE = "Ziyarn";

/**
 * Updates the browser tab title to show unread notifications when the tab is
 * not focused. Renders nothing — side-effect only.
 */
export function DashboardTitleUpdater() {
  const { unreadNotificationCount } = useNotificationSummary();

  useEffect(() => {
    if (unreadNotificationCount > 0 && document.hidden) {
      document.title = `(${unreadNotificationCount}) ${BASE_TITLE}`;
    } else {
      document.title = BASE_TITLE;
    }
  }, [unreadNotificationCount]);

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
