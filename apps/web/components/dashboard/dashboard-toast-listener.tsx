"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { APP_ROUTES } from "@/constants/routes";
import { setActiveWorkspaceCookie } from "@/lib/active-workspace";
import { useNotificationSummary } from "@/hooks/use-notification-summary";

/** A poll that recovers after a short outage should not toast stale events. */
const TOAST_MAX_AGE_MS = 2 * 60 * 1000;

/**
 * Plays a short 3-note ascending chime (C5 → E5 → G5) using the Web Audio API.
 * No audio file needed — the tone is generated programmatically.
 */
function playNotificationSound() {
  try {
    const audioContext = new AudioContext();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const noteDuration = 0.12;
    const noteGap = 0.06;

    for (let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";
      const frequency = notes[noteIndex];
      if (frequency === undefined) continue;
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);

      gainNode.gain.setValueAtTime(
        0.3,
        audioContext.currentTime + noteIndex * (noteDuration + noteGap),
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime +
          noteIndex * (noteDuration + noteGap) +
          noteDuration,
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const startTime =
        audioContext.currentTime + noteIndex * (noteDuration + noteGap);
      oscillator.start(startTime);
      oscillator.stop(startTime + noteDuration);
    }
  } catch {
    // Web Audio not available — silently ignore
  }
}

/**
 * Listens for new notification events and triggers:
 * 1. In-app toast (when the document is visible)
 * 2. Browser notification + sound (when the document is hidden)
 *
 * Renders nothing — side-effect only.
 */
export function DashboardToastListener() {
  const { latestNotification } = useNotificationSummary();
  const lastMarkerRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const hasRequestedPermissionRef = useRef(false);

  // Request browser notification permission on mount (once)
  useEffect(() => {
    if (hasRequestedPermissionRef.current) return;
    hasRequestedPermissionRef.current = true;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!latestNotification) {
      if (!initializedRef.current) initializedRef.current = true;
      lastMarkerRef.current = null;
      return;
    }

    const notification = latestNotification;
    const marker = `${notification.id}:${notification.updatedAt}`;

    if (!initializedRef.current) {
      initializedRef.current = true;
      lastMarkerRef.current = marker;
      return;
    }

    if (marker === lastMarkerRef.current) return;
    lastMarkerRef.current = marker;

    const updatedAt = new Date(notification.updatedAt).getTime();
    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > TOAST_MAX_AGE_MS) {
      return;
    }

    function openLatestNotification() {
      if (!notification.conversationId) return;
      setActiveWorkspaceCookie(notification.workspaceId);
      window.location.assign(
        `${APP_ROUTES.DASHBOARD_CONVERSATIONS}?conversationId=${encodeURIComponent(
          notification.conversationId,
        )}`,
      );
    }

    if (!document.hidden) {
      toast("New escalation", {
        description: notification.body,
        action: {
          label: "View",
          onClick: openLatestNotification,
        },
        duration: 10_000,
      });
    }

    if (
      document.hidden &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      playNotificationSound();
      const browserNotification = new Notification("Ziyarn", {
        body: notification.body,
        icon: "/favicon.ico",
        tag: notification.id,
      });
      browserNotification.onclick = () => {
        window.focus();
        openLatestNotification();
      };
    }
  }, [latestNotification]);

  return null;
}
