-- Per-agent creativity and an explicit widget agent.
-- Idempotent: the drizzle journal is desynced from hand-applied migrations,
-- so this file is applied manually (same pattern as 0032-0037).

-- NULL keeps the provider's default sampling temperature.
ALTER TABLE "agents" ADD COLUMN IF NOT EXISTS "temperature" real;

-- One chosen widget agent per domain. No row falls back to the oldest agent,
-- and deleting the chosen agent removes the row via the cascade.
CREATE TABLE IF NOT EXISTS "domain_agent_defaults" (
  "domain_id" uuid PRIMARY KEY NOT NULL REFERENCES "domains"("id") ON DELETE CASCADE,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "domain_agent_defaults_agent_id_idx"
  ON "domain_agent_defaults" ("agent_id");
