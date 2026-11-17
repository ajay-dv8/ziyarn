"use client";

import { useEffect, useRef, useState } from "react";

import {
  getNotificationSummaryAction,
  type NotificationSummaryView,
} from "@/lib/actions/notifications";

const POLL_INTERVAL_MS = 10_000;

const EMPTY_SUMMARY: NotificationSummaryView = {
  unreadNotificationCount: 0,
  openEscalatedCount: 0,
  latestNotification: null,
};

let globalInterval: ReturnType<typeof setInterval> | null = null;
const globalListeners = new Set<(summary: NotificationSummaryView) => void>();
let globalSummary = EMPTY_SUMMARY;
let fetchPending = false;
let refreshQueued = false;

function poll() {
  if (fetchPending) {
    refreshQueued = true;
    return;
  }
  fetchPending = true;
  getNotificationSummaryAction()
    .then((result) => {
      if (result.ok && result.summary) {
        globalSummary = result.summary;
        for (const listener of globalListeners) {
          listener(globalSummary);
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      fetchPending = false;
      if (refreshQueued) {
        refreshQueued = false;
        poll();
      }
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

/** Force the shared summary to refresh after a read action or status change. */
export function refreshNotificationSummary() {
  poll();
}

/**
 * One shared 10s poll for the bell, sidebar, tab title and toast listener.
 * A failed poll keeps the last known summary instead of showing zero.
 */
export function useNotificationSummary() {
  const [summary, setSummary] = useState(globalSummary);
  const listenerRef = useRef(setSummary);

  useEffect(() => {
    const listener = (nextSummary: NotificationSummaryView) => {
      listenerRef.current(nextSummary);
    };
    globalListeners.add(listener);
    startPolling();
    listenerRef.current(globalSummary);

    return () => {
      globalListeners.delete(listener);
      stopPolling();
    };
  }, []);

  return summary;
}
