import {
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Shared fixed-window counters for public-chat rate limiting.
 *
 * One row represents one key and one 60-second window. The limiter increments
 * the row with a single atomic upsert, so every serverless instance sees the
 * same total. Rows are deleted by the scheduler once their window is over.
 */
export const rateLimitWindows = pgTable(
  "rate_limit_windows",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [
    primaryKey({
      name: "rate_limit_windows_key_window_start_pk",
      columns: [table.key, table.windowStart],
    }),
    index("rate_limit_windows_window_start_idx").on(table.windowStart),
  ],
);

export type RateLimitWindow = typeof rateLimitWindows.$inferSelect;
