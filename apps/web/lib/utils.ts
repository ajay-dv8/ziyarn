/**
 * Format a date into a short relative time string.
 *
 * Examples:
 *   - < 60s → "now"
 *   - 1min → "1min", 5min → "5min"
 *   - 1h → "1h", 3h → "3h"
 *   - 1d → "1d", 5d → "5d"
 *   - 1w → "1w", 2w → "2w"
 *   - 1mo → "1mo", 6mo → "6mo"
 */
export function formatRelativeTime(date: Date | string): string {
  const now = Date.now();
  const then = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  const diffSeconds = Math.max(0, Math.floor((now - then) / 1000));

  if (diffSeconds < 60) return "now";

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w`;

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo`;
}

/**
 * Format a date into a short datetime string for display in the messenger header.
 *
 * Examples:
 *   - "Aug 30, 2026 2:15 PM"
 */
export function formatFullDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
