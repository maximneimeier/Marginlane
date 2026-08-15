import type {
  CogsCategory,
  CogsLineItem,
  CogsPlanCell,
} from "./types";
import { createId } from "./format";

export function cogsCellKey(lineItemId: string, monthKey: string): string {
  return `${lineItemId}::${monthKey}`;
}

export function cogsPlanMap(
  cells: CogsPlanCell[],
): Map<string, CogsPlanCell> {
  const map = new Map<string, CogsPlanCell>();
  for (const cell of cells) {
    if (!cell.lineItemId || !cell.monthKey) continue;
    const amount = Math.max(0, cell.amount || 0);
    if (amount <= 0) continue;
    map.set(cogsCellKey(cell.lineItemId, cell.monthKey), {
      lineItemId: cell.lineItemId,
      monthKey: cell.monthKey,
      amount,
    });
  }
  return map;
}

export function getCogsAmount(
  cells: CogsPlanCell[],
  lineItemId: string,
  monthKey: string,
): number {
  const hit = cells.find(
    (c) => c.lineItemId === lineItemId && c.monthKey === monthKey,
  );
  return hit ? Math.max(0, hit.amount || 0) : 0;
}

export function mergeCogsPlan(
  existing: CogsPlanCell[],
  updates: CogsPlanCell[],
): CogsPlanCell[] {
  const map = cogsPlanMap(existing);
  for (const u of updates) {
    const lineItemId =
      typeof u.lineItemId === "string" ? u.lineItemId.trim() : "";
    const monthKey =
      typeof u.monthKey === "string" ? u.monthKey.trim() : "";
    if (!lineItemId || !/^\d{4}-\d{2}$/.test(monthKey)) continue;
    const amount = Math.max(0, Number(u.amount) || 0);
    const key = cogsCellKey(lineItemId, monthKey);
    if (amount <= 0) map.delete(key);
    else map.set(key, { lineItemId, monthKey, amount });
  }
  return [...map.values()].sort((a, b) =>
    a.lineItemId === b.lineItemId
      ? a.monthKey.localeCompare(b.monthKey)
      : a.lineItemId.localeCompare(b.lineItemId),
  );
}

export function normalizeCogsPlanCell(
  raw: Partial<CogsPlanCell> | null | undefined,
): CogsPlanCell | null {
  const lineItemId =
    typeof raw?.lineItemId === "string" ? raw.lineItemId.trim() : "";
  const monthKey =
    typeof raw?.monthKey === "string" ? raw.monthKey.trim() : "";
  if (!lineItemId || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const amount = Math.max(0, Number(raw?.amount) || 0);
  if (amount <= 0) return null;
  return { lineItemId, monthKey, amount };
}

export function normalizeCogsCategory(
  raw: Partial<CogsCategory> | null | undefined,
): CogsCategory {
  const now = new Date().toISOString();
  return {
    id: typeof raw?.id === "string" && raw.id ? raw.id : createId("cgc"),
    name: typeof raw?.name === "string" ? raw.name : "",
    sortOrder: Number.isFinite(Number(raw?.sortOrder))
      ? Number(raw?.sortOrder)
      : 0,
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : now,
  };
}

export function normalizeCogsLineItem(
  raw: Partial<CogsLineItem> | null | undefined,
): CogsLineItem {
  const now = new Date().toISOString();
  return {
    id: typeof raw?.id === "string" && raw.id ? raw.id : createId("cgi"),
    categoryId:
      typeof raw?.categoryId === "string" ? raw.categoryId : "",
    name: typeof raw?.name === "string" ? raw.name : "",
    sortOrder: Number.isFinite(Number(raw?.sortOrder))
      ? Number(raw?.sortOrder)
      : 0,
    createdAt: typeof raw?.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : now,
  };
}

export function sumCogsForMonths(
  cells: CogsPlanCell[],
  months: string[],
  lineItemIds?: string[],
): number[] {
  const idSet = lineItemIds ? new Set(lineItemIds) : null;
  return months.map((month) =>
    cells.reduce((sum, cell) => {
      if (cell.monthKey !== month) return sum;
      if (idSet && !idSet.has(cell.lineItemId)) return sum;
      return sum + Math.max(0, cell.amount || 0);
    }, 0),
  );
}

export function sumCogsLineAcrossMonths(
  cells: CogsPlanCell[],
  lineItemId: string,
  months: string[],
): number {
  const monthSet = new Set(months);
  return cells.reduce((sum, cell) => {
    if (cell.lineItemId !== lineItemId) return sum;
    if (!monthSet.has(cell.monthKey)) return sum;
    return sum + Math.max(0, cell.amount || 0);
  }, 0);
}

/** Standard-Struktur analog Consolidated COGS (anpassbar). */
export function defaultCogsStructure(now = new Date().toISOString()): {
  categories: CogsCategory[];
  lineItems: CogsLineItem[];
} {
  const cats: Array<{ id: string; name: string; lines: string[] }> = [
    {
      id: "cgc_material",
      name: "Material / Einkauf",
      lines: ["Einkauf / BOM", "Verpackung", "Ausschuss & Nacharbeit"],
    },
    {
      id: "cgc_logistics",
      name: "Transport & Logistik",
      lines: ["Fracht inbound", "Zoll & Abgaben", "Handling / Umschlag"],
    },
    {
      id: "cgc_warehouse",
      name: "Lager",
      lines: ["Lagerung", "Kommissionierung"],
    },
    {
      id: "cgc_other",
      name: "Sonstige direkte Kosten",
      lines: ["Externe Fertigung", "Sonstige COGS"],
    },
  ];

  const categories: CogsCategory[] = cats.map((c, i) => ({
    id: c.id,
    name: c.name,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));

  const lineItems: CogsLineItem[] = [];
  let sort = 0;
  for (const c of cats) {
    c.lines.forEach((name, i) => {
      lineItems.push({
        id: `cgi_${c.id}_${i}`,
        categoryId: c.id,
        name,
        sortOrder: sort++,
        createdAt: now,
        updatedAt: now,
      });
    });
  }

  return { categories, lineItems };
}

export function emptyCogsCategory(sortOrder = 0): CogsCategory {
  const now = new Date().toISOString();
  return {
    id: createId("cgc"),
    name: "",
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

export function emptyCogsLineItem(
  categoryId: string,
  sortOrder = 0,
): CogsLineItem {
  const now = new Date().toISOString();
  return {
    id: createId("cgi"),
    categoryId,
    name: "",
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}
