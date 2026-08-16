import type { AppData } from "@/lib/types";
import { EMPTY_DATA } from "@/lib/types";
import { migrateAppData } from "@/lib/migrateAppData";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type WorkspaceModule = "invest" | "batches";

export type WorkspaceMeta = {
  id: string;
  name: string;
  module: WorkspaceModule;
  createdAt: string;
  updatedAt: string;
  companyName: string | null;
  baseCurrency: string | null;
  batchCount: number;
  productCount: number;
  supplierCount: number;
  componentCount: number;
  /** Investa: SG&A-Positionen */
  overheadCount: number;
  /** Investa: Personalrollen */
  personnelCount: number;
  /** Investa: COGS-Kostenzeilen */
  cogsLineCount: number;
};

export type WorkspaceRecord = WorkspaceMeta & {
  data: AppData;
};

function asAppData(value: unknown): AppData {
  return migrateAppData(value ?? EMPTY_DATA);
}

function isAppModule(value: string): value is WorkspaceModule {
  return value === "invest" || value === "batches";
}

function arrayLen(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function toMeta(row: {
  id: string;
  name: string;
  module: string;
  createdAt: Date;
  updatedAt: Date;
  data?: unknown;
}): WorkspaceMeta {
  const raw =
    row.data && typeof row.data === "object"
      ? (row.data as Record<string, unknown>)
      : {};
  const settings =
    raw.companySettings && typeof raw.companySettings === "object"
      ? (raw.companySettings as Record<string, unknown>)
      : {};
  const companyName =
    typeof settings.companyName === "string" && settings.companyName.trim()
      ? settings.companyName.trim()
      : null;
  const baseCurrency =
    typeof settings.baseCurrency === "string" && settings.baseCurrency.trim()
      ? settings.baseCurrency.trim()
      : null;

  return {
    id: row.id,
    name: row.name,
    module: isAppModule(row.module) ? row.module : "invest",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    companyName,
    baseCurrency,
    batchCount: arrayLen(raw.batches),
    productCount: arrayLen(raw.catalogProducts),
    supplierCount: arrayLen(raw.suppliers),
    componentCount: arrayLen(raw.components),
    overheadCount: arrayLen(raw.overheadItems),
    personnelCount: arrayLen(raw.personnelRoles),
    cogsLineCount: arrayLen(raw.cogsLineItems),
  };
}

async function maybePersistMigration(id: string, rowData: unknown, migrated: AppData) {
  const raw = rowData as Record<string, unknown> | null;
  const needsPersist =
    !raw ||
    !Array.isArray(raw.components) ||
    (Array.isArray(raw.products) &&
      (raw.products as unknown[]).length > 0 &&
      migrated.products.length === 0) ||
    (Array.isArray(raw.batches) &&
      raw.batches.some(
        (b) =>
          b &&
          typeof b === "object" &&
          "sales" in b &&
          !Array.isArray((b as { sales?: unknown }).sales),
      ));
  if (needsPersist) {
    await prisma.workspace.update({
      where: { id },
      data: { data: migrated as unknown as Prisma.InputJsonValue },
    });
  }
}

export async function listWorkspaces(module: WorkspaceModule): Promise<WorkspaceMeta[]> {
  await ensureSeedProjects();
  const rows = await prisma.workspace.findMany({
    where: { module },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      module: true,
      createdAt: true,
      updatedAt: true,
      data: true,
    },
  });
  return rows.map(toMeta);
}

/** Stellt sicher, dass Demo-Projekte für Investa und Costerra existieren — jeweils eigene Daten. */
async function ensureSeedProjects() {
  const seeds: {
    id: string;
    name: string;
    module: WorkspaceModule;
  }[] = [
    { id: "default", name: "Athenik Demo", module: "invest" },
    { id: "default-batches", name: "Athenik Demo", module: "batches" },
  ];

  for (const seed of seeds) {
    const existing = await prisma.workspace.findUnique({
      where: { id: seed.id },
      select: { id: true, name: true, module: true },
    });
    if (existing) {
      if (existing.name !== seed.name || existing.module !== seed.module) {
        await prisma.workspace.update({
          where: { id: seed.id },
          data: { name: seed.name, module: seed.module },
        });
      }
      continue;
    }

    // Niemals Daten von einem anderen Projekt kopieren — eigene leere DB.
    await prisma.workspace.create({
      data: {
        id: seed.id,
        name: seed.name,
        module: seed.module,
        data: emptyAppDataJson(),
      },
    });
  }
}

function emptyAppDataJson(): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(EMPTY_DATA)) as Prisma.InputJsonValue;
}

export async function createWorkspace(
  name: string,
  module: WorkspaceModule,
): Promise<WorkspaceRecord> {
  const trimmed = name.trim() || (module === "invest" ? "Investa-Projekt" : "Costerra-Projekt");
  const empty = emptyAppDataJson();
  const row = await prisma.workspace.create({
    data: {
      name: trimmed,
      module,
      data: empty,
    },
  });
  return {
    ...toMeta({ ...row, data: empty }),
    data: migrateAppData(JSON.parse(JSON.stringify(EMPTY_DATA))),
  };
}

export async function getWorkspace(id: string): Promise<WorkspaceRecord | null> {
  const row = await prisma.workspace.findUnique({ where: { id } });
  if (!row) return null;
  const migrated = asAppData(row.data);
  await maybePersistMigration(id, row.data, migrated);
  return { ...toMeta(row), data: migrated };
}

export async function saveWorkspaceData(
  id: string,
  data: AppData,
): Promise<AppData> {
  const next = asAppData(data);
  await prisma.workspace.update({
    where: { id },
    data: { data: next as unknown as Prisma.InputJsonValue },
  });
  return next;
}

export async function renameWorkspace(
  id: string,
  name: string,
): Promise<WorkspaceMeta | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  try {
    const row = await prisma.workspace.update({
      where: { id },
      data: { name: trimmed },
    });
    return toMeta(row);
  } catch {
    return null;
  }
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  try {
    await prisma.workspace.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function clearWorkspaceData(id: string): Promise<AppData | null> {
  const existing = await prisma.workspace.findUnique({ where: { id } });
  if (!existing) return null;
  return saveWorkspaceData(id, { ...EMPTY_DATA });
}
