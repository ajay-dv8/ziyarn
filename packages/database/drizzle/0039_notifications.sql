-- Short-lived in-app notifications for the dashboard bell.
-- The escalated-conversation sidebar count is derived from conversations.status,
-- so expiry/cleanup cannot hide an open escalation.
-- Idempotent: the drizzle journal is desynced from hand-applied migrations,
-- so this file is applied manually (same pattern as 0038).

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "domain_id" uuid REFERENCES "domains"("id") ON DELETE CASCADE,
  "conversation_id" uuid REFERENCES "conversations"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "read_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "notifications_user_dedupe_idx"
  ON "notifications" ("user_id", "dedupe_key");

CREATE INDEX IF NOT EXISTS "notifications_user_updated_idx"
  ON "notifications" ("user_id", "updated_at");

CREATE INDEX IF NOT EXISTS "notifications_user_read_idx"
  ON "notifications" ("user_id", "read_at");

CREATE INDEX IF NOT EXISTS "notifications_conversation_id_idx"
  ON "notifications" ("conversation_id");

CREATE INDEX IF NOT EXISTS "notifications_workspace_id_idx"
  ON "notifications" ("workspace_id");

CREATE INDEX IF NOT EXISTS "notifications_expires_at_idx"
  ON "notifications" ("expires_at");
