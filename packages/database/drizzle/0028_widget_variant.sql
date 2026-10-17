-- 0028_widget_variant.sql
--
-- Per-domain widget selection. Owners pick which widget renders on their site;
-- the widget resolves an unknown or missing value to the default at runtime
-- rather than failing, so existing embeds (which carry no data-variant) keep
-- working untouched.
--
-- Hand-written and applied directly to Neon — the drizzle journal in this repo is
-- already inconsistent (see plan/voice-plan.md §13).

-- 'classic' is the widget that shipped in P3 and is still the default.
-- NotNull + default means every existing domain is already correct: the
-- migration is a no-op for current rows and there is nothing to backfill.
ALTER TABLE domains
  ADD COLUMN IF NOT EXISTS widget_variant text NOT NULL DEFAULT 'classic';