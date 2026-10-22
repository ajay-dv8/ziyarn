-- 0029_rate_limit_windows.sql
--
-- Shared fixed-window counters for the public chat API. The limiter uses one
-- atomic upsert per message, so separate serverless instances share the same
-- limit instead of keeping an independent in-memory map.
--
-- Hand-written and applied directly to Neon — the drizzle journal in this repo
-- is already inconsistent (see plan/voice-plan.md §13). Keep this file as the
-- source of truth for the table shape.

CREATE TABLE IF NOT EXISTS "rate_limit_windows" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_windows_key_window_start_pk" PRIMARY KEY("key","window_start")
);

CREATE INDEX IF NOT EXISTS "rate_limit_windows_window_start_idx"
	ON "rate_limit_windows" USING btree ("window_start");
