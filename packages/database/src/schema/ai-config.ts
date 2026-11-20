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
import { workspaces } from "@repo/database/schema/workspaces";

/**
 * Bring-your-own AI provider (BYOA), workspace level.
 *
 * One row per workspace. `ownerId` records who connected it and is not an
 * access grant. `provider` is plain text — the registry in
 * services/api/src/ai/providers.ts is the source of truth, so adding a
 * provider never needs a migration. API keys are stored AES-256-GCM encrypted
 * and are never returned to a client unmasked.
 */
export const aiConfigs = pgTable(
  "ai_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Who connected it. Not an access grant; the workspace owns the row. */
    ownerId: text("owner_id").references(() => user.id, {
      onDelete: "set null",
    }),
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
    uniqueIndex("ai_configs_workspace_id_idx").on(table.workspaceId),
    index("ai_configs_provider_idx").on(table.provider),
  ],
);

/**
 * Per-domain override. A row here replaces the workspace-level provider for
 * that domain; deleting it reverts the domain to the workspace default.
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
    /** Optional BYO embeddings model; null inherits the workspace choice. */
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
