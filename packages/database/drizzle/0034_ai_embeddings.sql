-- Bring-your-own embeddings.
-- Reuses the row's provider, key and base URL; only the model is new.
-- NULL means "keep using the platform embedding model".
-- Idempotent: the drizzle journal is desynced from hand-applied migrations,
-- so this file is applied manually (see plan/byoa-plan.md).

ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "embedding_model" text;

--> statement-breakpoint

ALTER TABLE "domain_ai_configs" ADD COLUMN IF NOT EXISTS "embedding_model" text;
