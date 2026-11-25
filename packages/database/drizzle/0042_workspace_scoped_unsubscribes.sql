-- Unsubscribes are workspace-scoped: a suppression blocks sends only in the
-- workspace where the recipient unsubscribed or a member blocked them.
-- owner_id stays as creator/audit only.
--
-- Legacy rows had no workspace. Copy each one to the workspaces where the
-- address is actually known (customer, campaign recipient, or owned by the
-- row's creator), preserving the old global suppression where it mattered.
-- Rows that cannot be mapped to any workspace are dropped.

DROP INDEX IF EXISTS "unsubscribed_emails_email_idx";
ALTER TABLE "unsubscribed_emails" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;

UPDATE "unsubscribed_emails"
SET "email" = lower(btrim("email"))
WHERE "email" <> lower(btrim("email"));

WITH targets AS (
  SELECT u."id" AS source_id, d."workspace_id"
  FROM "unsubscribed_emails" u
  JOIN "customers" c ON c."email_lower" = lower(u."email")
  JOIN "domains" d ON d."id" = c."domain_id"
  WHERE u."workspace_id" IS NULL
  UNION
  SELECT u."id", c."workspace_id"
  FROM "unsubscribed_emails" u
  JOIN "campaign_recipients" cr ON lower(cr."email") = lower(u."email")
  JOIN "campaigns" c ON c."id" = cr."campaign_id"
  WHERE u."workspace_id" IS NULL
  UNION
  SELECT u."id", w."id"
  FROM "unsubscribed_emails" u
  JOIN "workspaces" w ON w."owner_id" = u."owner_id"
  WHERE u."workspace_id" IS NULL
)
INSERT INTO "unsubscribed_emails" ("workspace_id", "owner_id", "email", "created_at")
SELECT DISTINCT ON (t."workspace_id", lower(u."email"))
  t."workspace_id", u."owner_id", lower(u."email"), u."created_at"
FROM targets t
JOIN "unsubscribed_emails" u ON u."id" = t."source_id"
ORDER BY t."workspace_id", lower(u."email"), u."created_at"
ON CONFLICT DO NOTHING;

DELETE FROM "unsubscribed_emails" WHERE "workspace_id" IS NULL;

DELETE FROM "unsubscribed_emails" older
USING "unsubscribed_emails" newer
WHERE older."workspace_id" = newer."workspace_id"
  AND older."email" = newer."email"
  AND older."id" < newer."id";

ALTER TABLE "unsubscribed_emails" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "unsubscribed_emails"
  DROP CONSTRAINT IF EXISTS "unsubscribed_emails_workspace_id_workspaces_id_fk";
ALTER TABLE "unsubscribed_emails"
  ADD CONSTRAINT "unsubscribed_emails_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "unsubscribed_emails_workspace_email_idx"
  ON "unsubscribed_emails" ("workspace_id", "email");
