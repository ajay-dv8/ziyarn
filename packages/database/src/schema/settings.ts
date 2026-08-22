import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "@repo/database/schema/auth";

export const userSettings = pgTable(
  "user_settings",
  {
    ownerId: text("owner_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    defaultCurrency: text("default_currency").notNull().default("ghs"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
