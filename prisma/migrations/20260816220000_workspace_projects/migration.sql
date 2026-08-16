-- AlterTable: multi-project workspaces (Investa / Costerra)
ALTER TABLE "Workspace" ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "Workspace" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Mein Projekt';
ALTER TABLE "Workspace" ADD COLUMN "module" TEXT NOT NULL DEFAULT 'invest';
ALTER TABLE "Workspace" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing default row → Investa project
UPDATE "Workspace"
SET "name" = 'Mein Investa-Projekt', "module" = 'invest'
WHERE "id" = 'default';

-- Duplicate existing data as a Costerra starter project (if default exists)
INSERT INTO "Workspace" ("id", "name", "module", "data", "createdAt", "updatedAt")
SELECT
  'default-batches',
  'Mein Costerra-Projekt',
  'batches',
  "data",
  CURRENT_TIMESTAMP,
  "updatedAt"
FROM "Workspace"
WHERE "id" = 'default'
  AND NOT EXISTS (
    SELECT 1 FROM "Workspace" WHERE "id" = 'default-batches'
  );

CREATE INDEX "Workspace_module_idx" ON "Workspace"("module");
