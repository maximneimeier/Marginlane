import type { AppData } from "@/lib/types";
import { EMPTY_DATA } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const WORKSPACE_ID = "default";

function asAppData(value: unknown): AppData {
  if (!value || typeof value !== "object") return { ...EMPTY_DATA };
  const raw = value as Partial<AppData>;
  return {
    suppliers: Array.isArray(raw.suppliers) ? raw.suppliers : [],
    products: Array.isArray(raw.products) ? raw.products : [],
    catalogProducts: Array.isArray(raw.catalogProducts) ? raw.catalogProducts : [],
    dealers: Array.isArray(raw.dealers) ? raw.dealers : [],
    batches: Array.isArray(raw.batches) ? raw.batches : [],
    overheadItems: Array.isArray(raw.overheadItems) ? raw.overheadItems : [],
  };
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
  return asAppData(row.data);
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
