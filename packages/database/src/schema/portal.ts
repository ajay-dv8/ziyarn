import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "@repo/database/schema/auth";
import { domains } from "@repo/database/schema/domains";
import { products } from "@repo/database/schema/products";
import { conversations } from "@repo/database/schema/index";

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" },
    ),
    name: text("name"),
    email: text("email"),
    date: text("date").notNull(),
    time: text("time").notNull(),
    topic: text("topic"),
    status: text("status", {
      enum: ["pending", "confirmed", "cancelled"],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("bookings_domain_id_idx").on(table.domainId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" },
    ),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    email: text("email"),
    description: text("description"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    status: text("status", {
      enum: ["pending", "requires_payment", "paid", "failed"],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("payments_domain_id_idx").on(table.domainId)],
);

export const stripeAccounts = pgTable(
  "stripe_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeAccountId: text("stripe_account_id").notNull(),
    status: text("status", {
      enum: ["pending", "onboarding", "complete"],
    })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("stripe_accounts_owner_id_idx").on(table.ownerId)],
);

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type StripeAccount = typeof stripeAccounts.$inferSelect;
export type NewStripeAccount = typeof stripeAccounts.$inferInsert;
