-- Stripe Connect and the bring-your-own AI provider become workspace-scoped:
-- one connection per workspace, shared by its members. `owner_id` now records
-- who connected the service (not an access grant) and is cleared if that user
-- is deleted, so a member leaving cannot delete a workspace's connection.
--
-- Idempotent: the drizzle journal is desynced from hand-applied migrations,
-- so this file is applied manually (same pattern as 0038-0039).

ALTER TABLE "stripe_accounts" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;
ALTER TABLE "ai_configs" ADD COLUMN IF NOT EXISTS "workspace_id" uuid;

-- Owners that predate the workspace feature have integrations but no
-- workspace. Create one and make them its owner.
INSERT INTO "workspaces" ("name", "owner_id")
SELECT format('Workspace for %s', left(legacy."owner_id", 8)), legacy."owner_id"
FROM (
  SELECT "owner_id" FROM "stripe_accounts"
  WHERE "workspace_id" IS NULL AND "owner_id" IS NOT NULL
  UNION
  SELECT "owner_id" FROM "ai_configs"
  WHERE "workspace_id" IS NULL AND "owner_id" IS NOT NULL
) legacy
WHERE NOT EXISTS (
  SELECT 1 FROM "workspace_members" wm WHERE wm."user_id" = legacy."owner_id"
)
AND NOT EXISTS (
  SELECT 1 FROM "workspaces" w WHERE w."owner_id" = legacy."owner_id"
);

INSERT INTO "workspace_members" ("workspace_id", "user_id", "role")
SELECT w."id", w."owner_id", 'owner'
FROM "workspaces" w
WHERE w."owner_id" IN (
  SELECT "owner_id" FROM "stripe_accounts"
  WHERE "workspace_id" IS NULL AND "owner_id" IS NOT NULL
  UNION
  SELECT "owner_id" FROM "ai_configs"
  WHERE "workspace_id" IS NULL AND "owner_id" IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1 FROM "workspace_members" wm
  WHERE wm."workspace_id" = w."id" AND wm."user_id" = w."owner_id"
);

-- Existing rows go to the connector's first-joined workspace. Older
-- workspaces win, so a connection never jumps into a newer workspace.
UPDATE "stripe_accounts" sa
SET "workspace_id" = (
  SELECT wm."workspace_id"
  FROM "workspace_members" wm
  WHERE wm."user_id" = sa."owner_id"
  ORDER BY wm."created_at" ASC, wm."workspace_id" ASC
  LIMIT 1
)
WHERE sa."workspace_id" IS NULL AND sa."owner_id" IS NOT NULL;

UPDATE "ai_configs" ac
SET "workspace_id" = (
  SELECT wm."workspace_id"
  FROM "workspace_members" wm
  WHERE wm."user_id" = ac."owner_id"
  ORDER BY wm."created_at" ASC, wm."workspace_id" ASC
  LIMIT 1
)
WHERE ac."workspace_id" IS NULL AND ac."owner_id" IS NOT NULL;

-- A workspace can only keep one connection. If two members connected before
-- this migration, keep the complete/newest Stripe row and the newest AI row.
DELETE FROM "stripe_accounts" loser
USING "stripe_accounts" keeper
WHERE loser."workspace_id" = keeper."workspace_id"
  AND loser."id" <> keeper."id"
  AND (
    CASE WHEN loser."status" = 'complete' THEN 1 ELSE 0 END,
    loser."updated_at",
    loser."id"
  ) < (
    CASE WHEN keeper."status" = 'complete' THEN 1 ELSE 0 END,
    keeper."updated_at",
    keeper."id"
  );

DELETE FROM "ai_configs" loser
USING "ai_configs" keeper
WHERE loser."workspace_id" = keeper."workspace_id"
  AND loser."id" <> keeper."id"
  AND (loser."updated_at", loser."id") < (keeper."updated_at", keeper."id");

ALTER TABLE "stripe_accounts" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "ai_configs" ALTER COLUMN "workspace_id" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_configs"
    ADD CONSTRAINT "ai_configs_workspace_id_workspaces_id_fk"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP INDEX IF EXISTS "stripe_accounts_owner_id_idx";
DROP INDEX IF EXISTS "ai_configs_owner_id_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "stripe_accounts_workspace_id_idx"
  ON "stripe_accounts" ("workspace_id");

CREATE UNIQUE INDEX IF NOT EXISTS "ai_configs_workspace_id_idx"
  ON "ai_configs" ("workspace_id");

-- Deleting the connector must not delete the workspace's shared connection.
ALTER TABLE "stripe_accounts" ALTER COLUMN "owner_id" DROP NOT NULL;
ALTER TABLE "ai_configs" ALTER COLUMN "owner_id" DROP NOT NULL;

ALTER TABLE "stripe_accounts"
  DROP CONSTRAINT IF EXISTS "stripe_accounts_owner_id_user_id_fk";
ALTER TABLE "ai_configs"
  DROP CONSTRAINT IF EXISTS "ai_configs_owner_id_user_id_fk";

DO $$ BEGIN
  ALTER TABLE "stripe_accounts"
    ADD CONSTRAINT "stripe_accounts_owner_id_user_id_fk"
    FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ai_configs"
    ADD CONSTRAINT "ai_configs_owner_id_user_id_fk"
    FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
