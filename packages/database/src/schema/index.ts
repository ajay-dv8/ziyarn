export * from "@repo/database/schema/auth";
export * from "@repo/database/schema/admins";
export * from "@repo/database/schema/ai-config";
export * from "@repo/database/schema/billing";
export * from "@repo/database/schema/domains";
export * from "@repo/database/schema/portal";
export * from "@repo/database/schema/products";
export * from "@repo/database/schema/rate-limit";
export * from "@repo/database/schema/settings";
export * from "@repo/database/schema/workspaces";

import { user } from "@repo/database/schema/auth";
import { domains } from "@repo/database/schema/domains";
import { workspaces } from "@repo/database/schema/workspaces";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    instructions: text("instructions"),
    systemPrompt: text("system_prompt"),
    tools: text("tools").array().default([]),
    knowledgeSourceIds: uuid("knowledge_source_ids").array().default([]),
    filterQuestions: jsonb("filter_questions"),
    // NULL keeps the provider's default sampling temperature.
    temperature: real("temperature"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("agents_name_idx").on(table.name),
    index("agents_domain_id_idx").on(table.domainId),
  ],
);

/**
 * The agent the widget should use. No row means the oldest agent is used, so
 * deleting the default simply falls back instead of leaving the domain stuck.
 */
export const domainAgentDefaults = pgTable(
  "domain_agent_defaults",
  {
    domainId: uuid("domain_id")
      .primaryKey()
      .references(() => domains.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("domain_agent_defaults_agent_id_idx").on(table.agentId)],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    visitorId: text("visitor_id"),
    title: text("title"),
    status: text("status", {
      enum: ["active", "escalated", "resolved", "closed"],
    })
      .notNull()
      .default("active"),
    ownerSeenAt: timestamp("owner_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conversations_agent_id_idx").on(table.agentId),
    index("conversations_user_id_idx").on(table.userId),
    index("conversations_visitor_id_idx").on(table.visitorId),
  ],
);

export const toolCalls = pgTable(
  "tool_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    arguments: text("arguments"),
    result: text("result"),
    status: text("status", {
      enum: ["pending", "success", "error"],
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("tool_calls_conversation_id_idx").on(table.conversationId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["user", "assistant", "system", "tool"],
    }).notNull(),
    sender: text("sender", {
      enum: ["visitor", "owner", "assistant"],
    })
      .notNull()
      .default("assistant"),
    content: text("content").notNull(),
    toolCallId: uuid("tool_call_id").references(() => toolCalls.id, {
      onDelete: "set null",
    }),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("messages_conversation_id_idx").on(table.conversationId),
    index("messages_role_idx").on(table.role),
  ],
);

/**
 * Short-lived delivery metadata for the dashboard notification bell. The
 * escalated-conversation count in the sidebar comes from conversations.status,
 * so deleting an expired notification can never hide an open escalation.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    domainId: uuid("domain_id").references(() => domains.id, {
      onDelete: "cascade",
    }),
    conversationId: uuid("conversation_id").references(
      () => conversations.id,
      { onDelete: "cascade" },
    ),
    type: text("type", {
      enum: ["conversation_escalated"],
    }).notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("notifications_user_dedupe_idx").on(
      table.userId,
      table.dedupeKey,
    ),
    index("notifications_user_updated_idx").on(
      table.userId,
      table.updatedAt,
    ),
    index("notifications_user_read_idx").on(table.userId, table.readAt),
    index("notifications_conversation_id_idx").on(table.conversationId),
    index("notifications_workspace_id_idx").on(table.workspaceId),
    index("notifications_expires_at_idx").on(table.expiresAt),
  ],
);

export const crawlJobs = pgTable(
  "crawl_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    status: text("status", {
      enum: ["pending", "running", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    pagesFound: integer("pages_found").notNull().default(0),
    pagesCrawled: integer("pages_crawled").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("crawl_jobs_agent_id_idx").on(table.agentId)],
);

export const dataSources = pgTable(
  "data_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["postgres", "mysql", "mongodb", "convex"],
    }).notNull(),
    label: text("label").notNull(),
    host: text("host"),
    databaseName: text("database_name"),
    credentialsEncrypted: text("credentials_encrypted").notNull(),
    status: text("status", { enum: ["connected", "failed"] })
      .notNull()
      .default("connected"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("data_sources_agent_id_idx").on(table.agentId)],
);

export const dataSourceTables = pgTable(
  "data_source_tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dataSourceId: uuid("data_source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    tableName: text("table_name").notNull(),
    columnsJson: jsonb("columns_json"),
    rowCount: integer("row_count"),
    relevant: boolean("relevant").notNull().default(false),
    included: boolean("included").notNull().default(false),
    includeProducts: boolean("include_products").notNull().default(false),
    includeOrders: boolean("include_orders").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("data_source_tables_data_source_id_idx").on(table.dataSourceId),
  ],
);

export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    crawlJobId: uuid("crawl_job_id").references(() => crawlJobs.id, {
      onDelete: "set null",
    }),
    dataSourceId: uuid("data_source_id").references(() => dataSources.id, {
      onDelete: "cascade",
    }),
    source: text("source").notNull(),
    title: text("title"),
    fileName: text("file_name"),
    fileMime: text("file_mime"),
    fileSize: integer("file_size"),
    storageKey: text("storage_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("knowledge_documents_agent_id_idx").on(table.agentId),
    index("knowledge_documents_crawl_job_id_idx").on(table.crawlJobId),
  ],
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => knowledgeDocuments.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    position: text("position"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("document_chunks_document_id_idx").on(table.documentId)],
);

export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => documentChunks.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("embeddings_chunk_id_idx").on(table.chunkId)],
);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    email: text("email"),
    issue: text("issue").notNull(),
    status: text("status", {
      enum: ["open", "in_progress", "resolved", "closed"],
    })
      .notNull()
      .default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("support_tickets_conversation_id_idx").on(table.conversationId)],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" },
    ),
    name: text("name"),
    email: text("email"),
    company: text("company"),
    interest: text("interest"),
    answers: jsonb("answers"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("leads_email_idx").on(table.email)],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domainId: uuid("domain_id")
      .notNull()
      .references(() => domains.id, { onDelete: "cascade" }),
    emailLower: text("email_lower").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    source: text("source", {
      enum: ["chat", "database", "site"],
    })
      .notNull()
      .default("chat"),
    sourceLabel: text("source_label"),
    conversationId: uuid("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("customers_domain_email_lower_idx").on(
      table.domainId,
      table.emailLower,
    ),
    index("customers_domain_source_idx").on(table.domainId, table.source),
  ],
);
