import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { domains } from "@repo/database/schema/domains";
import { dataSources } from "@repo/database/schema";

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    dataSourceId: uuid("data_source_id").references(
      () => dataSources.id,
      { onDelete: "cascade" },
    ),
    externalKey: text("external_key"),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    currency: text("currency", {
      enum: ["ghs", "usd", "eur", "gbp"],
    })
      .notNull()
      .default("ghs"),
    active: boolean("active").notNull().default(true),
    availability: text("availability"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("products_domain_id_idx").on(table.domainId),
    uniqueIndex("products_domain_external_key_idx").on(
      table.domainId,
      table.externalKey,
    ),
  ],
);

export type Product = typeof products.$inferSelect;