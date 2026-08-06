import { createId } from "./format";
import {
  buildOverview,
  inRange,
  parseDateInput,
  type DateRange,
} from "./overview";
import { calculateResolvedEconomics } from "./resolve";
import type {
  AppData,
  OverheadItem,
  Product,
} from "./types";

export type ProductActivity = {
  productId: string;
  name: string;
  revenue: number;
  quantity: number;
  db3: number;
};

export type OverheadProductAllocation = {
  productId: string;
  name: string;
  overhead: number;
  db3: number;
  afterOverhead: number;
};

export type OverheadPeriodReport = {
  totalOverhead: number;
  totalDb3: number;
  operatingResult: number;
  items: Array<OverheadItem & { periodAmount: number }>;
  byProduct: OverheadProductAllocation[];
};

/** Inclusive calendar months spanned by the date range. */
export function monthsInRange(range: DateRange): number {
  const from = parseDateInput(range.from);
  const to = parseDateInput(range.to);
  if (!from || !to || to < from) return 0;
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) +
    1
  );
}

/** Convert a recurring overhead item to its monthly equivalent. */
export function monthlyEquivalent(item: OverheadItem): number {
  switch (item.periode) {
    case "monatlich":
      return item.betrag;
    case "quartalsweise":
      return item.betrag / 3;
    case "jaehrlich":
      return item.betrag / 12;
  }
}

/** Amount of one overhead item attributable to the selected date range. */
export function amountForRange(item: OverheadItem, range: DateRange): number {
  return monthlyEquivalent(item) * monthsInRange(range);
}

export function sumManualPercents(
  shares: { percent: number }[] | null | undefined,
): number {
  if (!shares?.length) return 0;
  return shares.reduce((acc, row) => acc + (Number.isFinite(row.percent) ? row.percent : 0), 0);
}

export function isManualAllocationValid(
  shares: { percent: number }[] | null | undefined,
): boolean {
  if (!shares?.length) return false;
  return Math.abs(sumManualPercents(shares) - 100) < 0.05;
}

/**
 * Products with sales activity in range (for revenue / unit keys),
 * plus DB3 from the overview breakdown.
 */
export function buildProductActivity(
  data: AppData,
  range: DateRange,
): ProductActivity[] {
  const overview = buildOverview(data, range, { productIds: null });
  const db3ByProduct = new Map(overview.byProduct.map((r) => [r.id, r]));

  const qtyMap = new Map<string, { quantity: number; revenue: number }>();
  for (const batch of data.batches) {
    if (!inRange(batch.createdAt, range)) continue;
    const resolved = calculateResolvedEconomics(data, batch);
    const existing = qtyMap.get(batch.productId) ?? {
      quantity: 0,
      revenue: 0,
    };
    existing.quantity += resolved.quantity;
    existing.revenue += resolved.sellPrice * resolved.quantity;
    qtyMap.set(batch.productId, existing);
  }

  const ids = new Set<string>([
    ...qtyMap.keys(),
    ...overview.byProduct.map((r) => r.id),
  ]);

  const rows: ProductActivity[] = [];
  for (const productId of ids) {
    const product = data.products.find((p) => p.id === productId);
    const activity = qtyMap.get(productId);
    const breakdown = db3ByProduct.get(productId);
    rows.push({
      productId,
      name: product?.name ?? breakdown?.name ?? productId,
      revenue: activity?.revenue ?? breakdown?.revenue ?? 0,
      quantity: activity?.quantity ?? 0,
      db3: breakdown?.db3 ?? 0,
    });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

function weightMap(
  item: OverheadItem,
  activity: ProductActivity[],
  allProducts: Product[],
): Map<string, number> {
  const weights = new Map<string, number>();

  if (item.verteilschluessel === "manuell") {
    for (const share of item.manuelleAufteilung ?? []) {
      weights.set(share.productId, Math.max(0, share.percent) / 100);
    }
    return weights;
  }

  const pool =
    activity.length > 0
      ? activity
      : allProducts.map((p) => ({
          productId: p.id,
          name: p.name,
          revenue: 0,
          quantity: 0,
          db3: 0,
        }));

  if (pool.length === 0) return weights;

  if (item.verteilschluessel === "gleichmaessig") {
    const each = 1 / pool.length;
    for (const row of pool) weights.set(row.productId, each);
    return weights;
  }

  if (item.verteilschluessel === "nach_umsatzanteil") {
    const total = pool.reduce((acc, r) => acc + r.revenue, 0);
    if (total <= 0) {
      const each = 1 / pool.length;
      for (const row of pool) weights.set(row.productId, each);
      return weights;
    }
    for (const row of pool) weights.set(row.productId, row.revenue / total);
    return weights;
  }

  // nach_stueckzahl
  const totalQty = pool.reduce((acc, r) => acc + r.quantity, 0);
  if (totalQty <= 0) {
    const each = 1 / pool.length;
    for (const row of pool) weights.set(row.productId, each);
    return weights;
  }
  for (const row of pool) weights.set(row.productId, row.quantity / totalQty);
  return weights;
}

export function allocateOverheadToProducts(
  items: OverheadItem[],
  range: DateRange,
  data: AppData,
): Map<string, number> {
  const activity = buildProductActivity(data, range);
  const allocated = new Map<string, number>();

  for (const item of items) {
    const periodAmount = amountForRange(item, range);
    if (periodAmount === 0) continue;
    const weights = weightMap(item, activity, data.products);
    let weightSum = 0;
    for (const w of weights.values()) weightSum += w;
    if (weightSum <= 0) continue;

    for (const [productId, weight] of weights) {
      const share = (periodAmount * weight) / weightSum;
      allocated.set(productId, (allocated.get(productId) ?? 0) + share);
    }
  }

  return allocated;
}

export function buildOverheadReport(
  data: AppData,
  range: DateRange,
): OverheadPeriodReport {
  const items = (data.overheadItems ?? []).map((item) => ({
    ...item,
    periodAmount: amountForRange(item, range),
  }));
  const totalOverhead = items.reduce((acc, item) => acc + item.periodAmount, 0);
  const overview = buildOverview(data, range, { productIds: null });
  const totalDb3 = overview.kpis.db3;
  const operatingResult = totalDb3 - totalOverhead;

  const activity = buildProductActivity(data, range);
  const allocated = allocateOverheadToProducts(
    data.overheadItems ?? [],
    range,
    data,
  );

  const productIds = new Set<string>([
    ...activity.map((a) => a.productId),
    ...allocated.keys(),
  ]);

  // Include manually referenced products even without activity
  for (const item of data.overheadItems ?? []) {
    for (const share of item.manuelleAufteilung ?? []) {
      productIds.add(share.productId);
    }
  }

  const byProduct: OverheadProductAllocation[] = [...productIds]
    .map((productId) => {
      const product = data.products.find((p) => p.id === productId);
      const act = activity.find((a) => a.productId === productId);
      const overhead = allocated.get(productId) ?? 0;
      const db3 = act?.db3 ?? 0;
      return {
        productId,
        name: product?.name ?? act?.name ?? productId,
        overhead,
        db3,
        afterOverhead: db3 - overhead,
      };
    })
    .filter((row) => row.overhead !== 0 || row.db3 !== 0)
    .sort((a, b) => b.overhead - a.overhead);

  return {
    totalOverhead,
    totalDb3,
    operatingResult,
    items: items.sort((a, b) => a.name.localeCompare(b.name)),
    byProduct,
  };
}

export function emptyOverheadItem(currency = "EUR"): OverheadItem {
  return {
    id: createId("oh"),
    name: "",
    betrag: 0,
    waehrung: currency,
    periode: "monatlich",
    kategorie: "verwaltung",
    verteilschluessel: "gleichmaessig",
    manuelleAufteilung: null,
    createdAt: new Date().toISOString(),
  };
}
