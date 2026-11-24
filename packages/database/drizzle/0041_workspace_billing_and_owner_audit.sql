-- Billing follows workspace ownership, and creator columns on workspace-owned
-- rows become audit-only: deleting a member clears the creator instead of
-- deleting shared domains, campaigns, or unsubscribe records. A workspace
-- owner cannot be deleted until ownership is transferred.

-- Recompute the per-domain plan cache from the workspace owner's active
-- subscription. Workspaces whose owner has no active plan go back to free.
UPDATE "domains" AS d
SET "plan" = COALESCE((
    SELECT s."plan"
    FROM "workspaces" w
    JOIN "subscriptions" s ON s."owner_id" = w."owner_id"
    WHERE w."id" = d."workspace_id"
      AND s."status" IN ('active', 'trialing', 'past_due')
    LIMIT 1
  ), 'free'),
  "updated_at" = now();

ALTER TABLE "domains" ALTER COLUMN "owner_id" DROP NOT NULL;
ALTER TABLE "domains" DROP CONSTRAINT IF EXISTS "domains_owner_id_user_id_fk";
ALTER TABLE "domains"
  ADD CONSTRAINT "domains_owner_id_user_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE SET NULL;

ALTER TABLE "campaigns" ALTER COLUMN "owner_id" DROP NOT NULL;
ALTER TABLE "campaigns" DROP CONSTRAINT IF EXISTS "campaigns_owner_id_user_id_fk";
ALTER TABLE "campaigns"
  ADD CONSTRAINT "campaigns_owner_id_user_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE SET NULL;

UPDATE "unsubscribed_emails" AS u
SET "owner_id" = NULL
WHERE u."owner_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "user" WHERE "id" = u."owner_id");
ALTER TABLE "unsubscribed_emails" ALTER COLUMN "owner_id" DROP NOT NULL;
ALTER TABLE "unsubscribed_emails" DROP CONSTRAINT IF EXISTS "unsubscribed_emails_owner_id_user_id_fk";
ALTER TABLE "unsubscribed_emails"
  ADD CONSTRAINT "unsubscribed_emails_owner_id_user_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE SET NULL;

ALTER TABLE "workspaces" DROP CONSTRAINT IF EXISTS "workspaces_owner_id_user_id_fk";
ALTER TABLE "workspaces"
  ADD CONSTRAINT "workspaces_owner_id_user_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE RESTRICT;
