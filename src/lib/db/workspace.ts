import type { AppData } from "@/lib/types";
import { EMPTY_DATA } from "@/lib/types";
import { migrateAppData } from "@/lib/migrateAppData";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const WORKSPACE_ID = "default";

function asAppData(value: unknown): AppData {
  return migrateAppData(value ?? EMPTY_DATA);
}

export async function getWorkspaceData(): Promise<AppData> {
  const row = await prisma.workspace.findUnique({
    where: { id: WORKSPACE_ID },
  });
  if (!row) {
    await prisma.workspace.create({
      data: {
        id: WORKSPACE_ID,
        data: EMPTY_DATA as unknown as Prisma.InputJsonValue,
      },
    });
    return { ...EMPTY_DATA };
  }
  const migrated = asAppData(row.data);
  // Persistierte Form nach Migration speichern (einmalig / bei Shape-Änderung)
  const raw = row.data as Record<string, unknown> | null;
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
      where: { id: WORKSPACE_ID },
      data: { data: migrated as unknown as Prisma.InputJsonValue },
    });
  }
  return migrated;
}

export async function saveWorkspaceData(data: AppData): Promise<AppData> {
  const next = asAppData(data);
  await prisma.workspace.upsert({
    where: { id: WORKSPACE_ID },
    create: {
      id: WORKSPACE_ID,
      data: next as unknown as Prisma.InputJsonValue,
    },
    update: { data: next as unknown as Prisma.InputJsonValue },
  });
  return next;
}

export async function clearWorkspaceData(): Promise<AppData> {
  return saveWorkspaceData({ ...EMPTY_DATA });
}
