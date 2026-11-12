import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "@repo/database/schema/auth";
import { domains } from "@repo/database/schema/domains";

/**
 * Bring-your-own AI provider (BYOA), account level.
 *
 * One row per account (the user who owns the domains). `provider` is plain
 * text — the registry in services/api/src/ai/providers.ts is the source of
 * truth, so adding a provider never needs a migration. API keys are stored
 * AES-256-GCM encrypted and are never returned to a client unmasked.
 */
export const aiConfigs = pgTable(
  "ai_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("platform"),
    model: text("model"),
    /** Optional BYO embeddings model; null keeps platform embeddings. */
    embeddingModel: text("embedding_model"),
    apiKeyEncrypted: text("api_key_encrypted"),
    baseUrl: text("base_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ai_configs_owner_id_idx").on(table.ownerId),
    index("ai_configs_provider_idx").on(table.provider),
  ],
);

/**
 * Per-domain override. A row here replaces the account-level provider for
 * that domain; deleting it reverts the domain to the account default.
 */
export const domainAiConfigs = pgTable(
  "domain_ai_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model"),
    /** Optional BYO embeddings model; null inherits the account choice. */
    embeddingModel: text("embedding_model"),
    apiKeyEncrypted: text("api_key_encrypted"),
    baseUrl: text("base_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("domain_ai_configs_domain_id_idx").on(table.domainId),
  ],
);
