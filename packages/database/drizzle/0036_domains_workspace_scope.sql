-- Domains become workspace-scoped: a domain always belongs to exactly one
-- workspace, and access is decided by membership in that workspace (not by
-- domain ownership or by sharing *any* workspace with the owner).

-- Owners that predate the workspace feature have domains but no workspace.
INSERT INTO "workspaces" ("name", "owner_id")
SELECT format('Workspace for %s', left(d."owner_id", 8)), d."owner_id"
FROM (SELECT DISTINCT "owner_id" FROM "domains") d
WHERE NOT EXISTS (
  SELECT 1 FROM "workspace_members" wm WHERE wm."user_id" = d."owner_id"
);

INSERT INTO "workspace_members" ("workspace_id", "user_id", "role")
SELECT w."id", w."owner_id", 'owner'
FROM "workspaces" w
WHERE w."owner_id" IN (SELECT DISTINCT "owner_id" FROM "domains")
  AND NOT EXISTS (
    SELECT 1 FROM "workspace_members" wm
    WHERE wm."workspace_id" = w."id" AND wm."user_id" = w."owner_id"
  );

-- Existing domains go to the owner's first-joined workspace. Older workspaces
-- win, so a domain never jumps into a workspace created after it.
UPDATE "domains" d
SET "workspace_id" = (
  SELECT wm."workspace_id"
  FROM "workspace_members" wm
  WHERE wm."user_id" = d."owner_id"
  ORDER BY wm."created_at" ASC, wm."workspace_id" ASC
  LIMIT 1
)
WHERE d."workspace_id" IS NULL;

ALTER TABLE "domains" DROP CONSTRAINT "domains_workspace_id_workspaces_id_fk";
ALTER TABLE "domains" ALTER COLUMN "workspace_id" SET NOT NULL;
ALTER TABLE "domains" ADD CONSTRAINT "domains_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE no action ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "domains_workspace_id_idx" ON "domains" ("workspace_id");
