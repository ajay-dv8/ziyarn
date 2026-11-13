import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
  jsonb,
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
    businessType: text("business_type", {
      enum: [
        "education",
        "health",
        "ecommerce",
        "hospitality",
        "food",
        "finance",
        "energy",
      ],
    }),
    embedSecret: text("embed_secret").notNull(),
    /**
     * Which widget renders on this domain's site. Kept as plain text (not a
     * drizzle enum) so shipping a new widget never needs a migration — the
     * registry in services/api/src/domains/widget-variants.ts is the source of
     * truth, and the widget falls back to the default for unknown values.
     */
    widgetVariant: text("widget_variant").notNull().default("classic"),
    /**
     * Which chat trigger (launcher) opens this domain's chat. Kept as plain
     * text (not a drizzle enum) so shipping a new trigger never needs a
     * migration — the registry in services/api/src/domains/chat-triggers.ts is
     * the source of truth, and the widget falls back to "default" for unknown
     * values, which is itself the launcher built into `widgetVariant`.
     */
    chatTrigger: text("chat_trigger").notNull().default("default"),
    /**
     * Per-trigger customization (pill label, bubble icon source, tooltip text
     * and visibility). One bag so customization grows without migrations; the
     * shape is validated by chatTriggerConfigSchema in @repo/api before it is
     * written, and resolved with runtime defaults on read.
     */
    chatTriggerConfig: jsonb("chat_trigger_config")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    /**
     * Saved places visitors can ask about. Validated by
     * domainLocationsSchema in @repo/api before writes; reads fail open to []
     * so a stale row cannot break the widget. Kept as one JSONB column for
     * the MVP — move to a table when branches need hours or per-location
     * staff.
     */
    locations: jsonb("locations")
      .$type<unknown[]>()
      .notNull()
      .default([]),
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
