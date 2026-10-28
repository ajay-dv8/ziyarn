-- Product page links. Nullable: older products and synced rows without a full
-- URL keep the existing widget behavior (no page action), and a re-sync must
-- never overwrite a manually entered URL with null.
--
-- Hand-written and applied directly to Neon — the drizzle journal in this repo
-- is already inconsistent (see plan/voice-plan.md §13).

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "product_url" text;
