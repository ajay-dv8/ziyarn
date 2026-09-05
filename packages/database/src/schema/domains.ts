import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
} from "drizzle-orm/pg-core";

import { user } from "@repo/database/schema/auth";

export const domains = pgTable(
  "domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logoUrl: text("logo_url"),
    embedSecret: text("embed_secret").notNull(),
    plan: text("plan", {
      enum: ["free", "standard", "pro", "ultimate", "custom"],
    })
      .notNull()
      .default("free"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("domains_slug_idx").on(table.slug),
    uniqueIndex("domains_embed_secret_idx").on(table.embedSecret),
    index("domains_owner_id_idx").on(table.ownerId),
  ],
);

export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
