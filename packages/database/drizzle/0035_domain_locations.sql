-- Verified business locations for the widget's exact map links.
-- Idempotent: the drizzle journal is desynced from hand-applied migrations,
-- so this file is applied manually (same pattern as 0032-0034).

ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "locations" jsonb DEFAULT '[]'::jsonb NOT NULL;
