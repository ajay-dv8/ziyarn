-- Bring-your-own AI provider (BYOA).
-- Idempotent: the drizzle journal is desynced from hand-applied migrations, so
-- this file is applied manually (see plan/byoa-plan.md) and can be re-run.
--
-- Apply to production with one of:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 0033_ai_config.sql
--   Neon console -> SQL Editor -> paste and run
--   node: split the file on the breakpoint marker and run each part
--         (see the deployment section of the README).

CREATE TABLE IF NOT EXISTS "ai_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" text NOT NULL,
  "provider" text DEFAULT 'platform' NOT NULL,
  "model" text,
  "api_key_encrypted" text,
  "base_url" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "ai_configs_owner_id_idx"
  ON "ai_configs" ("owner_id");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ai_configs_provider_idx"
  ON "ai_configs" ("provider");

--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "ai_configs"
    ADD CONSTRAINT "ai_configs_owner_id_user_id_fk"
    FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "domain_ai_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "domain_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "model" text,
  "api_key_encrypted" text,
  "base_url" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "domain_ai_configs_domain_id_idx"
  ON "domain_ai_configs" ("domain_id");

--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "domain_ai_configs"
    ADD CONSTRAINT "domain_ai_configs_domain_id_domains_id_fk"
    FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
