-- Campaigns become workspace-scoped: an email campaign belongs to one
-- workspace and is only visible/manageable from that workspace.

ALTER TABLE "campaigns" ADD COLUMN "workspace_id" uuid;

-- Owners that predate the workspace feature have campaigns but no workspace.
INSERT INTO "workspaces" ("name", "owner_id")
SELECT format('Workspace for %s', left(c."owner_id", 8)), c."owner_id"
FROM (SELECT DISTINCT "owner_id" FROM "campaigns") c
WHERE NOT EXISTS (
  SELECT 1 FROM "workspace_members" wm WHERE wm."user_id" = c."owner_id"
);

INSERT INTO "workspace_members" ("workspace_id", "user_id", "role")
SELECT w."id", w."owner_id", 'owner'
FROM "workspaces" w
WHERE w."owner_id" IN (SELECT DISTINCT "owner_id" FROM "campaigns")
  AND NOT EXISTS (
    SELECT 1 FROM "workspace_members" wm
    WHERE wm."workspace_id" = w."id" AND wm."user_id" = w."owner_id"
  );

-- Existing campaigns go to the owner's first-joined workspace, so a campaign
-- never jumps into a workspace created after it.
UPDATE "campaigns" c
SET "workspace_id" = (
  SELECT wm."workspace_id"
  FROM "workspace_members" wm
  WHERE wm."user_id" = c."owner_id"
  ORDER BY wm."created_at" ASC, wm."workspace_id" ASC
  LIMIT 1
)
WHERE c."workspace_id" IS NULL;

ALTER TABLE "campaigns" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE cascade ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "campaigns_workspace_id_idx" ON "campaigns" ("workspace_id");
