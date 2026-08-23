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
import { leads } from "@repo/database/schema/index";

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    customerCode: text("customer_code"),
    customerSubscriptionCode: text("customer_subscription_code"),
    plan: text("plan", {
      enum: ["standard", "pro", "ultimate"],
    }).notNull(),
    status: text("status", {
      enum: ["incomplete", "trialing", "active", "past_due", "canceled", "incomplete_expired"],
    })
      .notNull()
      .default("incomplete"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("subscriptions_owner_id_idx").on(table.ownerId),
    uniqueIndex("subscriptions_stripe_subscription_id_idx").on(
      table.stripeSubscriptionId,
    ),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status", {
      enum: ["draft", "scheduled", "sending", "sent", "cancelled"],
    })
      .notNull()
      .default("draft"),
    audience: text("audience", {
      enum: ["all", "chat", "database", "site"],
    })
      .notNull()
      .default("all"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentCount: integer("sent_count").notNull().default(0),
    deliveredCount: integer("delivered_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    unsubscribedCount: integer("unsubscribed_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("campaigns_owner_id_idx").on(table.ownerId)],
);

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    email: text("email").notNull(),
    unsubscribeToken: text("unsubscribe_token").notNull(),
    status: text("status", {
      enum: ["queued", "sent", "delivered", "bounced", "failed", "unsubscribed"],
    })
      .notNull()
      .default("queued"),
    resendEmailId: text("resend_email_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("campaign_recipients_campaign_id_idx").on(table.campaignId),
    uniqueIndex("campaign_recipients_resend_email_id_idx").on(
      table.resendEmailId,
    ),
  ],
);

export const unsubscribedEmails = pgTable(
  "unsubscribed_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("unsubscribed_emails_email_idx").on(table.email)],
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type NewCampaignRecipient = typeof campaignRecipients.$inferInsert;
export type UnsubscribedEmail = typeof unsubscribedEmails.$inferSelect;
export type NewUnsubscribedEmail = typeof unsubscribedEmails.$inferInsert;
