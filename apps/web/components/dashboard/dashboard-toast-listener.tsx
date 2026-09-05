"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useUnreadCount } from "@/hooks/use-unread-count";

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

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + noteIndex * (noteDuration + noteGap));
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + noteIndex * (noteDuration + noteGap) + noteDuration,
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const startTime = audioContext.currentTime + noteIndex * (noteDuration + noteGap);
      oscillator.start(startTime);
      oscillator.stop(startTime + noteDuration);
    }
  } catch {
    // Web Audio not available — silently ignore
  }
}

/**
 * Listens for unread count changes and triggers:
 * 1. In-app toast (always when document is visible)
 * 2. Browser notification + sound (when document is hidden)
 *
 * Renders nothing — side-effect only.
 */
export function DashboardToastListener() {
  const totalUnread = useUnreadCount();
  const router = useRouter();
  const previousCountRef = useRef(totalUnread);
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
    const previousCount = previousCountRef.current;
    previousCountRef.current = totalUnread;

    // Only notify on increment (new escalation arrived)
    if (totalUnread <= previousCount) return;

    // In-app toast (shown when tab is visible)
    if (!document.hidden) {
      toast("New escalation", {
        description: "A visitor has been connected to a human agent",
        action: {
          label: "View",
          onClick: () => router.push("/dashboard/conversations"),
        },
        duration: 10_000,
      });
    }

    // Browser notification + sound (shown when tab is hidden)
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      playNotificationSound();
      new Notification("Ziyarn", {
        body: "New visitor escalation — open to respond",
        icon: "/favicon.ico",
      });
    }
  }, [totalUnread, router]);

  return null;
}
