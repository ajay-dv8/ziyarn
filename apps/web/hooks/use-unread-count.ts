"use client";

import { useEffect, useRef, useState } from "react";

import { getTotalUnreadAction } from "@/lib/actions/conversations";

const POLL_INTERVAL_MS = 10_000;

/**
 * Shared hook that polls the server every 10s for the total unread message
 * count across all conversations. All consumers (sidebar badge, tab title,
 * toast listener) share the same polling interval via a module-level timer.
 */

let globalInterval: ReturnType<typeof setInterval> | null = null;
const globalListeners = new Set<(count: number) => void>();
let globalCount = 0;
let fetchPending = false;

function poll() {
  if (fetchPending) return;
  fetchPending = true;
  getTotalUnreadAction()
    .then((result) => {
      if (result.ok && typeof result.totalUnread === "number") {
        globalCount = result.totalUnread;
        for (const listener of globalListeners) {
          listener(globalCount);
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      fetchPending = false;
    });
}

function startPolling() {
  if (globalInterval) return;
  poll();
  globalInterval = setInterval(poll, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (globalListeners.size > 0 || !globalInterval) return;
  clearInterval(globalInterval);
  globalInterval = null;
}

export function useUnreadCount() {
  const [totalUnread, setTotalUnread] = useState(globalCount);
  const listenerRef = useRef(setTotalUnread);

  useEffect(() => {
    const listener = (count: number) => {
      listenerRef.current(count);
    };
    globalListeners.add(listener);
    startPolling();
    // Sync immediately with current global count
    listenerRef.current(globalCount);

    return () => {
      globalListeners.delete(listener);
      stopPolling();
    };
  }, []);

  return totalUnread;
}
