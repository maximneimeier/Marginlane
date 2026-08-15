import type { RevenuePlanCell } from "./types";
import { SEASON_PROFILES, type SeasonProfileId } from "./salesPlan";

export function cellKey(productId: string, monthKey: string): string {
  return `${productId}::${monthKey}`;
}

export function revenueAmount(cell: Pick<RevenuePlanCell, "quantity" | "unitPrice">): number {
  return Math.max(0, cell.quantity || 0) * Math.max(0, cell.unitPrice || 0);
}

export function revenuePlanMap(
  cells: RevenuePlanCell[],
): Map<string, RevenuePlanCell> {
  const map = new Map<string, RevenuePlanCell>();
  for (const cell of cells) {
    if (!cell.productId || !cell.monthKey) continue;
    map.set(cellKey(cell.productId, cell.monthKey), {
      productId: cell.productId,
      monthKey: cell.monthKey,
      quantity: Math.max(0, cell.quantity || 0),
      unitPrice: Math.max(0, cell.unitPrice || 0),
    });
  }
  return map;
}

export function getRevenuePlanCell(
  cells: RevenuePlanCell[],
  productId: string,
  monthKey: string,
): RevenuePlanCell | null {
  return (
    cells.find(
      (c) => c.productId === productId && c.monthKey === monthKey,
    ) ?? null
  );
}

/** Updates mergen; Menge und Preis beide 0 → Zelle entfernen. */
export function mergeRevenuePlan(
  existing: RevenuePlanCell[],
  updates: RevenuePlanCell[],
): RevenuePlanCell[] {
  const map = revenuePlanMap(existing);
  for (const u of updates) {
    const productId =
      typeof u.productId === "string" ? u.productId.trim() : "";
    const monthKey =
      typeof u.monthKey === "string" ? u.monthKey.trim() : "";
    if (!productId || !/^\d{4}-\d{2}$/.test(monthKey)) continue;
    const quantity = Math.max(0, Number(u.quantity) || 0);
    const unitPrice = Math.max(0, Number(u.unitPrice) || 0);
    const key = cellKey(productId, monthKey);
    if (quantity <= 0 && unitPrice <= 0) {
      map.delete(key);
    } else {
      map.set(key, { productId, monthKey, quantity, unitPrice });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.productId === b.productId
      ? a.monthKey.localeCompare(b.monthKey)
      : a.productId.localeCompare(b.productId),
  );
}

export function normalizeRevenuePlanCell(
  raw: Partial<RevenuePlanCell> & { amount?: number } | null | undefined,
): RevenuePlanCell | null {
  const productId =
    typeof raw?.productId === "string" ? raw.productId.trim() : "";
  const monthKey =
    typeof raw?.monthKey === "string" ? raw.monthKey.trim() : "";
  if (!productId || !/^\d{4}-\d{2}$/.test(monthKey)) return null;

  let quantity = Math.max(0, Number(raw?.quantity) || 0);
  let unitPrice = Math.max(0, Number(raw?.unitPrice) || 0);

  // Legacy Top-Line-Zellen ohne Produkt / nur amount → verwerfen
  if (
    quantity <= 0 &&
    unitPrice <= 0 &&
    typeof (raw as { amount?: number })?.amount === "number"
  ) {
    return null;
  }

  if (quantity <= 0 && unitPrice <= 0) return null;
  return { productId, monthKey, quantity, unitPrice };
}

export function sumRevenuePlan(
  cells: RevenuePlanCell[],
  opts?: { productId?: string; monthKeys?: string[] },
): number {
  const monthSet = opts?.monthKeys ? new Set(opts.monthKeys) : null;
  return cells.reduce((sum, cell) => {
    if (opts?.productId && cell.productId !== opts.productId) return sum;
    if (monthSet && !monthSet.has(cell.monthKey)) return sum;
    return sum + revenueAmount(cell);
  }, 0);
}

export function sumQuantityPlan(
  cells: RevenuePlanCell[],
  opts?: { productId?: string; monthKeys?: string[] },
): number {
  const monthSet = opts?.monthKeys ? new Set(opts.monthKeys) : null;
  return cells.reduce((sum, cell) => {
    if (opts?.productId && cell.productId !== opts.productId) return sum;
    if (monthSet && !monthSet.has(cell.monthKey)) return sum;
    return sum + Math.max(0, cell.quantity || 0);
  }, 0);
}

/** Gewichtete ASP über Zellen mit Menge > 0. */
export function averageSellingPrice(
  cells: RevenuePlanCell[],
  opts?: { productId?: string; monthKeys?: string[] },
): number {
  let qty = 0;
  let rev = 0;
  const monthSet = opts?.monthKeys ? new Set(opts.monthKeys) : null;
  for (const cell of cells) {
    if (opts?.productId && cell.productId !== opts.productId) continue;
    if (monthSet && !monthSet.has(cell.monthKey)) continue;
    const q = Math.max(0, cell.quantity || 0);
    if (q <= 0) continue;
    qty += q;
    rev += revenueAmount(cell);
  }
  return qty > 0 ? rev / qty : 0;
}

/**
 * Jahresmenge mit Saisonprofil verteilen, fester ASP.
 * FP&A: Volume-Driver × Rate-Driver.
 */
export function distributeAnnualVolume(
  productId: string,
  year: string,
  annualQuantity: number,
  unitPrice: number,
  months: string[],
  profileId: SeasonProfileId = "even",
): RevenuePlanCell[] {
  const yearMonths = months.filter((m) => m.startsWith(`${year}-`));
  if (yearMonths.length === 0) return [];

  const weights = SEASON_PROFILES[profileId] ?? SEASON_PROFILES.even;
  const monthWeights = yearMonths.map((m) => {
    const idx = Math.max(0, Math.min(11, Number(m.slice(5, 7)) - 1));
    return weights[idx] ?? 1;
  });
  const weightSum = monthWeights.reduce((s, w) => s + w, 0) || 1;
  const totalQty = Math.max(0, annualQuantity);
  const price = Math.max(0, unitPrice);

  let allocated = 0;
  const cells: RevenuePlanCell[] = yearMonths.map((monthKey, i) => {
    const isLast = i === yearMonths.length - 1;
    let quantity: number;
    if (isLast) {
      quantity = Math.round((totalQty - allocated) * 1000) / 1000;
    } else {
      quantity =
        Math.round(((totalQty * monthWeights[i]!) / weightSum) * 1000) / 1000;
      allocated += quantity;
    }
    return { productId, monthKey, quantity: Math.max(0, quantity), unitPrice: price };
  });
  return cells;
}

/**
 * Wachstum auf bestehende Mengen anwenden (YoY / Run-rate Style).
 * Preis bleibt unverändert; fehlende Monate → 0.
 */
export function applyVolumeGrowth(
  productId: string,
  cells: RevenuePlanCell[],
  months: string[],
  growthPercent: number,
  defaultUnitPrice: number,
): RevenuePlanCell[] {
  const rate = 1 + growthPercent / 100;
  const byMonth = new Map(
    cells
      .filter((c) => c.productId === productId)
      .map((c) => [c.monthKey, c] as const),
  );
  return months.map((monthKey) => {
    const prev = byMonth.get(monthKey);
    const quantity = Math.max(
      0,
      Math.round((prev?.quantity ?? 0) * rate * 1000) / 1000,
    );
    const unitPrice =
      prev && prev.unitPrice > 0
        ? prev.unitPrice
        : Math.max(0, defaultUnitPrice);
    return { productId, monthKey, quantity, unitPrice };
  });
}

/** ASP auf alle Monate eines Produkts setzen (Preis-Treiber). */
export function setProductUnitPrice(
  productId: string,
  cells: RevenuePlanCell[],
  months: string[],
  unitPrice: number,
): RevenuePlanCell[] {
  const price = Math.max(0, unitPrice);
  const byMonth = new Map(
    cells
      .filter((c) => c.productId === productId)
      .map((c) => [c.monthKey, c] as const),
  );
  return months.map((monthKey) => {
    const prev = byMonth.get(monthKey);
    return {
      productId,
      monthKey,
      quantity: prev?.quantity ?? 0,
      unitPrice: price,
    };
  });
}
