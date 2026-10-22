import * as Sentry from "@sentry/nextjs";
import { lt, sql } from "drizzle-orm";

import { db, type Database } from "@repo/database";
import { rateLimitWindows } from "@repo/database/schema";

import {
  CHAT_MESSAGE_LIMIT,
  CHAT_MESSAGE_WINDOW_MS,
  SharedRateLimiter,
  type RateLimitStore,
} from "./rate-limit";

/** Drizzle-backed store: one atomic upsert per message and one prune per cron tick. */
export function createDrizzleRateLimitStore(database: Database): RateLimitStore {
  return {
    async increment(key, windowStart) {
      const [row] = await database
        .insert(rateLimitWindows)
        .values({ key, windowStart, count: 1 })
        .onConflictDoUpdate({
          target: [rateLimitWindows.key, rateLimitWindows.windowStart],
          set: { count: sql`${rateLimitWindows.count} + 1` },
        })
        .returning({ count: rateLimitWindows.count });

      if (!row) {
        throw new Error("Rate-limit increment returned no row");
      }
      return row.count;
    },

    async prune(before) {
      const deleted = await database
        .delete(rateLimitWindows)
        .where(lt(rateLimitWindows.windowStart, before))
        .returning({ key: rateLimitWindows.key });
      return deleted.length;
    },
  };
}

export const chatRateLimiter = new SharedRateLimiter({
  store: createDrizzleRateLimitStore(db),
  max: CHAT_MESSAGE_LIMIT,
  windowMs: CHAT_MESSAGE_WINDOW_MS,
  onStoreError: (error) => {
    // Fail open, but make the failure visible. The key is intentionally not
    // attached: visitor IDs and domain IDs do not need to travel to Sentry.
    Sentry.captureException(error, {
      level: "warning",
      tags: { area: "chat-rate-limit" },
    });
  },
});

/**
 * Delete counters from windows that have already closed.
 *
 * Called from the existing scheduler route, so the table stays close to one
 * row per active visitor and never grows with historical traffic.
 */
export async function pruneRateLimitWindows(
  now: number = Date.now(),
): Promise<number> {
  try {
    return await chatRateLimiter.prune(
      new Date(now - CHAT_MESSAGE_WINDOW_MS),
    );
  } catch (error) {
    Sentry.captureException(error, {
      level: "warning",
      tags: { area: "chat-rate-limit-prune" },
    });
    throw error;
  }
}
