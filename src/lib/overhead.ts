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
  CatalogProduct,
  OverheadActual,
  OverheadCategory,
  OverheadItem,
} from "./types";
import { OVERHEAD_CATEGORIES } from "./types";
import { resolvePlanUnitPrice } from "./salesPlan";
import { expandPersonnelRolesToOverheadItems } from "./personnel";

/** Plan-Positionen inkl. expandierter Personalrollen (für Umlegung & Totals). */
export function effectivePlanOverheadItems(data: AppData): OverheadItem[] {
  return [
    ...(data.overheadItems ?? []),
    ...expandPersonnelRolesToOverheadItems(data.personnelRoles ?? []),
  ];
}

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
  /** Klassische Gemeinkosten-Positionen (ohne expandiertes Personal) */
  items: Array<OverheadItem & { periodAmount: number }>;
  /** Periodenanteil aus Personalrollen (Gehalt+NK + monatl. Pakete) */
  personnelAmount: number;
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

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function toDateInputLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monat aktiv, wenn irgendein Tag des Monats in [gueltigVon, gueltigBis] liegt. */
export function isMonthActiveForItem(
  year: number,
  monthIndex: number,
  gueltigVon: string | null,
  gueltigBis: string | null,
): boolean {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const from = gueltigVon ? parseDateInput(gueltigVon) : null;
  const to = gueltigBis ? parseDateInput(gueltigBis) : null;
  if (from && end < from) return false;
  if (to && start > to) return false;
  return true;
}

/**
 * Anzahl Kalendermonate im Report-Zeitraum, die zusätzlich in der
 * optionalen Gültigkeit der Position liegen.
 */
export function activeMonthsInRange(
  range: DateRange,
  gueltigVon: string | null,
  gueltigBis: string | null,
): number {
  const from = parseDateInput(range.from);
  const to = parseDateInput(range.to);
  if (!from || !to || to < from) return 0;

  let count = 0;
  let cursor = monthStart(from);
  const end = monthStart(to);
  while (cursor <= end) {
    if (
      isMonthActiveForItem(
        cursor.getFullYear(),
        cursor.getMonth(),
        gueltigVon,
        gueltigBis,
      )
    ) {
      count += 1;
    }
    cursor = addMonths(cursor, 1);
  }
  return count;
}

/** Convert a recurring overhead item's fixed portion to its monthly equivalent. */
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

export type OverheadActivityTotals = {
  quantity: number;
  revenue: number;
};

export function activityTotalsFromRows(
  rows: Array<{ quantity: number; revenue: number }>,
): OverheadActivityTotals {
  return rows.reduce(
    (acc, row) => ({
      quantity: acc.quantity + row.quantity,
      revenue: acc.revenue + row.revenue,
    }),
    { quantity: 0, revenue: 0 },
  );
}

export function activityTotalsForRange(
  data: AppData,
  range: DateRange,
): OverheadActivityTotals {
  return activityTotalsFromRows(buildProductActivity(data, range));
}

/**
 * Geplante Aktivität aus dem Absatzplan (Produkt × Monat, aktives Szenario).
 * Umsatz = Plan-VK (Meta → Händler-Default → Listenpreis) × Menge.
 */
export function buildPlannedProductActivity(
  data: AppData,
  range: DateRange,
): ProductActivity[] {
  const months = monthsKeysInRange(range);
  if (months.length === 0) return [];
  const monthSet = new Set(months);
  const scenario =
    data.salesPlanSettings?.activeScenario ?? ("base" as const);

  type Acc = { quantity: number; revenue: number };
  const byProduct = new Map<string, Acc>();

  for (const cell of data.salesPlan ?? []) {
    if ((cell.scenario ?? "base") !== scenario) continue;
    if (!monthSet.has(cell.month) || !(cell.quantity > 0)) continue;
    const price = resolvePlanUnitPrice(
      data,
      cell.productId,
      cell.dealerId ?? null,
      scenario,
    );
    const acc = byProduct.get(cell.productId) ?? { quantity: 0, revenue: 0 };
    acc.quantity += cell.quantity;
    acc.revenue += price * cell.quantity;
    byProduct.set(cell.productId, acc);
  }

  const rows: ProductActivity[] = [];
  for (const product of data.catalogProducts) {
    if (product.status !== "active") continue;
    const acc = byProduct.get(product.id);
    if (!acc || acc.quantity <= 0) continue;
    rows.push({
      productId: product.id,
      name: product.name || product.id,
      quantity: acc.quantity,
      revenue: acc.revenue,
      db3: 0,
    });
  }
  return rows;
}

export function plannedActivityTotalsForRange(
  data: AppData,
  range: DateRange,
): OverheadActivityTotals {
  return activityTotalsFromRows(buildPlannedProductActivity(data, range));
}

export function rangeForMonthKey(month: string): DateRange | null {
  const parsed = parseMonthKey(month);
  if (!parsed) return null;
  const from = new Date(parsed.year, parsed.monthIndex, 1);
  const to = new Date(parsed.year, parsed.monthIndex + 1, 0);
  return {
    from: toDateInputLocal(from),
    to: toDateInputLocal(to),
  };
}

/**
 * Betrag einer Position im Zeitraum.
 * - fix: Betrag × aktive Monate
 * - variabel: Rate × Stück oder % × Umsatz (aktive Monate anteilig)
 * - semi_variabel: Fixanteil + variabler Anteil
 */
export function amountForRange(
  item: OverheadItem,
  range: DateRange,
  activity: OverheadActivityTotals | null = null,
): number {
  const activeMonths = activeMonthsInRange(
    range,
    item.gueltigVon ?? null,
    item.gueltigBis ?? null,
  );
  if (activeMonths <= 0) return 0;

  const kostenart = item.kostenart ?? "fix";
  const fixedPart =
    kostenart === "variabel" ? 0 : monthlyEquivalent(item) * activeMonths;

  if (
    kostenart === "fix" ||
    !item.variableBasis ||
    item.variableRate == null ||
    !Number.isFinite(item.variableRate)
  ) {
    return fixedPart;
  }

  const totals = activity ?? { quantity: 0, revenue: 0 };
  const calendarMonths = monthsInRange(range);
  const scale = calendarMonths > 0 ? activeMonths / calendarMonths : 0;

  let variablePart = 0;
  if (item.variableBasis === "stueck") {
    variablePart = item.variableRate * totals.quantity * scale;
  } else if (item.variableBasis === "umsatz") {
    variablePart = (item.variableRate / 100) * totals.revenue * scale;
  }

  return fixedPart + variablePart;
}

export type OverheadCategorySlice = {
  kategorie: OverheadItem["kategorie"];
  amount: number;
};

/** Period totals grouped by overhead category. */
export function buildOverheadByCategory(
  items: OverheadItem[],
  range: DateRange,
  activity: OverheadActivityTotals | null = null,
): OverheadCategorySlice[] {
  const totals: Record<OverheadItem["kategorie"], number> = {
    materialgemeinkosten: 0,
    fertigungsgemeinkosten: 0,
    verwaltungsgemeinkosten: 0,
    vertriebsgemeinkosten: 0,
  };
  for (const item of items) {
    totals[item.kategorie] += amountForRange(item, range, activity);
  }
  return (Object.keys(totals) as OverheadItem["kategorie"][])
    .map((kategorie) => ({ kategorie, amount: totals[kategorie] }))
    .filter((row) => row.amount > 0);
}

/** Previous period of equal calendar length, ending the day before `range.from`. */
export function previousRangeOfSameLength(range: DateRange): DateRange | null {
  const from = parseDateInput(range.from);
  const to = parseDateInput(range.to);
  if (!from || !to || to < from) return null;
  const days =
    Math.round(
      (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000),
    ) + 1;
  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return {
    from: toDateInputLocal(prevFrom),
    to: toDateInputLocal(prevTo),
  };
}

/** Gleiche Kalenderdaten ein Jahr früher (YoY). */
export function yearAgoRange(range: DateRange): DateRange | null {
  const from = parseDateInput(range.from);
  const to = parseDateInput(range.to);
  if (!from || !to || to < from) return null;
  const fromY = new Date(from);
  fromY.setFullYear(fromY.getFullYear() - 1);
  const toY = new Date(to);
  toY.setFullYear(toY.getFullYear() - 1);
  return {
    from: toDateInputLocal(fromY),
    to: toDateInputLocal(toY),
  };
}

/**
 * Kalenderquartal von `range.from` im Vorjahr
 * (Q1=Jan–Mär, Q2=Apr–Jun, Q3=Jul–Sep, Q4=Okt–Dez).
 */
export function sameQuarterLastYear(range: DateRange): DateRange | null {
  const from = parseDateInput(range.from);
  if (!from) return null;
  const year = from.getFullYear() - 1;
  const q = Math.floor(from.getMonth() / 3);
  const qFrom = new Date(year, q * 3, 1);
  const qTo = new Date(year, q * 3 + 3, 0);
  return {
    from: toDateInputLocal(qFrom),
    to: toDateInputLocal(qTo),
  };
}

function sumOverheadInRange(
  items: OverheadItem[],
  range: DateRange,
  activity: OverheadActivityTotals | null = null,
): number {
  return items.reduce(
    (acc, item) => acc + amountForRange(item, range, activity),
    0,
  );
}

function periodDelta(
  currentTotal: number,
  compareRange: DateRange | null,
  items: OverheadItem[],
  data: AppData | null,
): OverheadPeriodCompare | null {
  if (!compareRange) return null;
  const activity = data ? activityTotalsForRange(data, compareRange) : null;
  const total = sumOverheadInRange(items, compareRange, activity);
  const delta = currentTotal - total;
  const deltaPercent =
    total > 0
      ? (delta / total) * 100
      : total === 0 && currentTotal === 0
        ? 0
        : null;
  return { range: compareRange, total, delta, deltaPercent };
}

export type OverheadPeriodCompare = {
  range: DateRange;
  total: number;
  delta: number;
  deltaPercent: number | null;
};

export type OverheadCategoryTrendRow = {
  kategorie: OverheadItem["kategorie"];
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number | null;
};

export type OverheadRunRate = {
  months: number;
  /** Summe Gemeinkosten in der gewählten Periode */
  periodTotal: number;
  /** Monatliche Run-Rate (Periodensumme / Monate) */
  monthlyRunRate: number;
  /** Hochrechnung auf 12 Monate */
  annualized: number;
  /** Periodensumme der vorherigen gleich langen Periode */
  previousPeriodTotal: number | null;
  /** Absolute Veränderung zur Vorperiode */
  deltaVsPrevious: number | null;
  /** Prozentuale Veränderung zur Vorperiode */
  deltaPercentVsPrevious: number | null;
  /** vs. gleiche Kalenderperiode Vorjahr */
  vsYearAgo: OverheadPeriodCompare | null;
  /** vs. gleiches Kalenderquartal Vorjahr (bezogen auf range.from) */
  vsQuarterLastYear: OverheadPeriodCompare | null;
  /** Ist je Kategorie vs. Vorperiode */
  byCategoryVsPrevious: OverheadCategoryTrendRow[];
};

export function buildOverheadRunRate(
  items: OverheadItem[],
  range: DateRange,
  data: AppData | null = null,
): OverheadRunRate {
  const months = monthsInRange(range);
  const activity = data ? activityTotalsForRange(data, range) : null;
  const periodTotal = sumOverheadInRange(items, range, activity);
  const monthlyRunRate = months > 0 ? periodTotal / months : 0;
  const annualized = monthlyRunRate * 12;

  const prev = previousRangeOfSameLength(range);
  const vsPrev = periodDelta(periodTotal, prev, items, data);
  const vsYearAgo = periodDelta(periodTotal, yearAgoRange(range), items, data);
  const vsQuarterLastYear = periodDelta(
    periodTotal,
    sameQuarterLastYear(range),
    items,
    data,
  );

  const currentByCat = buildOverheadByCategory(items, range, activity);
  const prevActivity = prev && data ? activityTotalsForRange(data, prev) : null;
  const prevByCat = prev
    ? buildOverheadByCategory(items, prev, prevActivity)
    : [];
  const prevMap = new Map(prevByCat.map((r) => [r.kategorie, r.amount]));
  const catIds = new Set([
    ...currentByCat.map((r) => r.kategorie),
    ...prevByCat.map((r) => r.kategorie),
  ]);

  const byCategoryVsPrevious: OverheadCategoryTrendRow[] = [
    ...OVERHEAD_CATEGORIES.filter((k) => catIds.has(k)),
  ].map((kategorie) => {
    const current = currentByCat.find((r) => r.kategorie === kategorie)?.amount ?? 0;
    const previous = prevMap.get(kategorie) ?? 0;
    const delta = current - previous;
    const deltaPercent =
      previous > 0
        ? (delta / previous) * 100
        : previous === 0 && current === 0
          ? 0
          : null;
    return { kategorie, current, previous, delta, deltaPercent };
  });

  return {
    months,
    periodTotal,
    monthlyRunRate,
    annualized,
    previousPeriodTotal: vsPrev?.total ?? null,
    deltaVsPrevious: vsPrev?.delta ?? null,
    deltaPercentVsPrevious: vsPrev?.deltaPercent ?? null,
    vsYearAgo,
    vsQuarterLastYear,
    byCategoryVsPrevious,
  };
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

export type OverheadAllocationIssueKind =
  | "manual_empty"
  | "manual_sum"
  | "inactive_products";

export type OverheadAllocationIssue = {
  itemId: string;
  itemName: string;
  kind: OverheadAllocationIssueKind;
  /** Summe der manuellen Prozente (bei manual_sum) */
  percentSum?: number;
  /** Produktnamen ohne Aktivität im Zeitraum */
  productNames?: string[];
};

/**
 * Prüft Verteilschlüssel / Cost Drivers:
 * - manuell ohne Aufteilung
 * - manuell ≠ ~100 %
 * - manuelle Anteile auf Produkte ohne Aktivität im Zeitraum
 */
export function buildOverheadAllocationIssues(
  data: AppData,
  range: DateRange,
): OverheadAllocationIssue[] {
  const activity = buildProductActivity(data, range);
  const activeIds = new Set(
    activity
      .filter((a) => a.revenue > 0 || a.quantity > 0)
      .map((a) => a.productId),
  );
  const nameById = new Map(
    data.catalogProducts.map((p) => [p.id, p.name || p.id]),
  );
  for (const a of activity) {
    if (!nameById.has(a.productId)) nameById.set(a.productId, a.name);
  }

  const issues: OverheadAllocationIssue[] = [];

  for (const item of effectivePlanOverheadItems(data)) {
    if (item.verteilschluessel !== "manuell") continue;

    const shares = item.manuelleAufteilung ?? [];
    const positive = shares.filter(
      (s) => Number.isFinite(s.percent) && s.percent > 0,
    );

    if (positive.length === 0) {
      issues.push({
        itemId: item.id,
        itemName: item.name || item.id,
        kind: "manual_empty",
      });
      continue;
    }

    if (!isManualAllocationValid(shares)) {
      issues.push({
        itemId: item.id,
        itemName: item.name || item.id,
        kind: "manual_sum",
        percentSum: Math.round(sumManualPercents(shares) * 100) / 100,
      });
    }

    const inactiveNames = positive
      .filter((s) => !activeIds.has(s.productId))
      .map((s) => nameById.get(s.productId) ?? s.productId);

    if (inactiveNames.length > 0) {
      issues.push({
        itemId: item.id,
        itemName: item.name || item.id,
        kind: "inactive_products",
        productNames: [...new Set(inactiveNames)],
      });
    }
  }

  return issues;
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
    const product = data.catalogProducts.find((p) => p.id === productId);
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
  allProducts: CatalogProduct[],
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
  const totals = activityTotalsFromRows(activity);
  const allocated = new Map<string, number>();

  for (const item of items) {
    const periodAmount = amountForRange(item, range, totals);
    if (periodAmount === 0) continue;
    const weights = weightMap(item, activity, data.catalogProducts);
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

export type OverheadSankeyGroupBy = "position" | "category";

export type OverheadSankeyNode = {
  id: string;
  label: string;
  kind: "overhead" | "product";
  depth: 0 | 1;
  amount: number;
};

export type OverheadSankeyLink = {
  source: string;
  target: string;
  value: number;
};

const CATEGORY_LABELS_FALLBACK: Record<OverheadItem["kategorie"], string> = {
  materialgemeinkosten: "Materialgemeinkosten",
  fertigungsgemeinkosten: "Fertigungsgemeinkosten",
  verwaltungsgemeinkosten: "Verwaltungsgemeinkosten",
  vertriebsgemeinkosten: "Vertriebsgemeinkosten",
};

/**
 * Fluss Gemeinkosten → Produkt für den gewählten Zeitraum.
 * `groupBy: "position"` = jede Position getrennt,
 * `groupBy: "category"` = Positionen nach Kategorie zusammengefasst.
 */
export function buildOverheadSankey(
  data: AppData,
  range: DateRange,
  groupBy: OverheadSankeyGroupBy = "position",
  categoryLabel?: (kategorie: OverheadItem["kategorie"]) => string,
): { nodes: OverheadSankeyNode[]; links: OverheadSankeyLink[] } {
  const activity = buildProductActivity(data, range);
  const totals = activityTotalsFromRows(activity);
  const linkMap = new Map<string, number>();
  const overheadTotals = new Map<string, { label: string; amount: number }>();
  const productTotals = new Map<string, { label: string; amount: number }>();

  for (const item of data.overheadItems ?? []) {
    const periodAmount = amountForRange(item, range, totals);
    if (periodAmount <= 0) continue;

    const weights = weightMap(item, activity, data.catalogProducts);
    let weightSum = 0;
    for (const w of weights.values()) weightSum += w;
    if (weightSum <= 0) continue;

    const sourceId =
      groupBy === "category" ? `cat:${item.kategorie}` : `oh:${item.id}`;
    const sourceLabel =
      groupBy === "category"
        ? (categoryLabel?.(item.kategorie) ??
          CATEGORY_LABELS_FALLBACK[item.kategorie])
        : item.name || item.id;

    overheadTotals.set(sourceId, {
      label: sourceLabel,
      amount: (overheadTotals.get(sourceId)?.amount ?? 0) + periodAmount,
    });

    for (const [productId, weight] of weights) {
      const share = (periodAmount * weight) / weightSum;
      if (share <= 0.005) continue;
      const targetId = `prd:${productId}`;
      const product = data.catalogProducts.find((p) => p.id === productId);
      const act = activity.find((a) => a.productId === productId);
      const label = product?.name ?? act?.name ?? productId;
      productTotals.set(targetId, {
        label,
        amount: (productTotals.get(targetId)?.amount ?? 0) + share,
      });
      const linkKey = `${sourceId}→${targetId}`;
      linkMap.set(linkKey, (linkMap.get(linkKey) ?? 0) + share);
    }
  }

  const links: OverheadSankeyLink[] = [...linkMap.entries()]
    .map(([key, value]) => {
      const [source, target] = key.split("→");
      return {
        source,
        target,
        value: Math.round(value * 100) / 100,
      };
    })
    .filter((l) => l.value > 0);

  const nodes: OverheadSankeyNode[] = [
    ...[...overheadTotals.entries()].map(([id, row]) => ({
      id,
      label: row.label,
      kind: "overhead" as const,
      depth: 0 as const,
      amount: row.amount,
    })),
    ...[...productTotals.entries()].map(([id, row]) => ({
      id,
      label: row.label,
      kind: "product" as const,
      depth: 1 as const,
      amount: row.amount,
    })),
  ];

  return { nodes, links };
}

export function buildOverheadReport(
  data: AppData,
  range: DateRange,
): OverheadPeriodReport {
  const totals = activityTotalsForRange(data, range);
  const planItems = effectivePlanOverheadItems(data);
  const personnelIds = new Set(
    expandPersonnelRolesToOverheadItems(data.personnelRoles ?? []).map(
      (i) => i.id,
    ),
  );

  const withAmounts = planItems.map((item) => ({
    ...item,
    periodAmount: amountForRange(item, range, totals),
  }));

  const items = withAmounts
    .filter((item) => !personnelIds.has(item.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const personnelAmount = withAmounts
    .filter((item) => personnelIds.has(item.id))
    .reduce((acc, item) => acc + item.periodAmount, 0);
  const totalOverhead =
    items.reduce((acc, item) => acc + item.periodAmount, 0) + personnelAmount;
  const overview = buildOverview(data, range, { productIds: null });
  const totalDb3 = overview.kpis.db3;
  const operatingResult = totalDb3 - totalOverhead;

  const activity = buildProductActivity(data, range);
  const allocated = allocateOverheadToProducts(planItems, range, data);

  const productIds = new Set<string>([
    ...activity.map((a) => a.productId),
    ...allocated.keys(),
  ]);

  for (const item of planItems) {
    for (const share of item.manuelleAufteilung ?? []) {
      productIds.add(share.productId);
    }
  }

  const byProduct: OverheadProductAllocation[] = [...productIds]
    .map((productId) => {
      const product = data.catalogProducts.find((p) => p.id === productId);
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
    items,
    personnelAmount,
    byProduct,
  };
}

export type OverheadWaterfallStepKind = "start" | "decrease" | "result";

export type OverheadWaterfallStep = {
  id: string;
  label: string;
  /** Absoluter Betrag der Stufe (immer ≥ 0 für Anzeige) */
  amount: number;
  kind: OverheadWaterfallStepKind;
  /** Unsichtbarer Sockel für Wasserfall-Stack */
  base: number;
};

export type OverheadWaterfall = {
  db3: number;
  totalOverhead: number;
  operatingResult: number;
  steps: OverheadWaterfallStep[];
};

/**
 * DB3 → Gemeinkosten (nach Kategorie) → Betriebsergebnis.
 * `base` + sichtbarer Balken = klassischer Wasserfall.
 */
export function buildOverheadWaterfall(
  data: AppData,
  range: DateRange,
  categoryLabel: (kategorie: OverheadItem["kategorie"]) => string,
): OverheadWaterfall {
  const report = buildOverheadReport(data, range);
  const totals = activityTotalsForRange(data, range);
  const categories = buildOverheadByCategory(
    effectivePlanOverheadItems(data),
    range,
    totals,
  );

  const steps: OverheadWaterfallStep[] = [];
  const db3 = report.totalDb3;
  let running = db3;

  steps.push({
    id: "db3",
    label: "DB3",
    amount: Math.abs(db3),
    kind: "start",
    base: db3 >= 0 ? 0 : db3,
  });

  for (const slice of categories) {
    const amount = slice.amount;
    if (amount <= 0) continue;
    const next = running - amount;
    // Floating bar from next → running (decrease)
    const low = Math.min(running, next);
    steps.push({
      id: `cat:${slice.kategorie}`,
      label: categoryLabel(slice.kategorie),
      amount,
      kind: "decrease",
      base: low,
    });
    running = next;
  }

  // If overhead without category breakdown still needed as one block
  if (categories.length === 0 && report.totalOverhead > 0) {
    const next = running - report.totalOverhead;
    const low = Math.min(running, next);
    steps.push({
      id: "overhead",
      label: "Gemeinkosten",
      amount: report.totalOverhead,
      kind: "decrease",
      base: low,
    });
    running = next;
  }

  const result = report.operatingResult;
  steps.push({
    id: "result",
    label: "Betriebsergebnis",
    amount: Math.abs(result),
    kind: "result",
    base: result >= 0 ? 0 : result,
  });

  return {
    db3: report.totalDb3,
    totalOverhead: report.totalOverhead,
    operatingResult: report.operatingResult,
    steps,
  };
}

export function emptyOverheadItem(currency = "EUR"): OverheadItem {
  const now = new Date().toISOString();
  return {
    id: createId("oh"),
    name: "",
    betrag: 0,
    waehrung: currency,
    periode: "monatlich",
    kategorie: "verwaltungsgemeinkosten",
    kostenart: "fix",
    variableBasis: null,
    variableRate: null,
    verteilschluessel: "gleichmaessig",
    manuelleAufteilung: null,
    gueltigVon: null,
    gueltigBis: null,
    createdAt: now,
    updatedAt: now,
    updatedBy: null,
  };
}

export function emptyOverheadActual(
  month: string,
  kategorie: OverheadCategory = "verwaltungsgemeinkosten",
  overheadItemId: string | null = null,
): OverheadActual {
  const now = new Date().toISOString();
  return {
    id: createId("oha"),
    name: "",
    month,
    kategorie,
    betrag: 0,
    overheadItemId,
    note: null,
    createdAt: now,
    updatedAt: now,
    updatedBy: null,
  };
}

/** Kalendermonate (YYYY-MM) im Report-Zeitraum, chronologisch. */
export function monthsKeysInRange(range: DateRange): string[] {
  const from = parseDateInput(range.from);
  const to = parseDateInput(range.to);
  if (!from || !to || to < from) return [];

  const keys: string[] = [];
  let cursor = monthStart(from);
  const end = monthStart(to);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    keys.push(`${y}-${m}`);
    cursor = addMonths(cursor, 1);
    if (keys.length > 120) break;
  }
  return keys;
}

function parseMonthKey(month: string): { year: number; monthIndex: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null;
  return { year, monthIndex };
}

/** Plan-Betrag einer Position für einen Kalendermonat. */
export function planAmountForMonth(
  item: OverheadItem,
  month: string,
  activity: OverheadActivityTotals | null = null,
): number {
  const monthRange = rangeForMonthKey(month);
  if (!monthRange) return 0;
  return amountForRange(item, monthRange, activity);
}

export type PlanVsActualCategoryRow = {
  kategorie: OverheadCategory;
  plan: number;
  actual: number;
  delta: number;
  deltaPercent: number | null;
};

export type PlanVsActualMonthRow = {
  month: string;
  plan: number;
  actual: number;
  delta: number;
  byCategory: Record<OverheadCategory, { plan: number; actual: number }>;
};

export type PlanVsActualReport = {
  months: string[];
  planTotal: number;
  actualTotal: number;
  delta: number;
  deltaPercent: number | null;
  byCategory: PlanVsActualCategoryRow[];
  byMonth: PlanVsActualMonthRow[];
  /** true wenn mindestens ein Ist-Betrag > 0 im Zeitraum */
  hasActuals: boolean;
};

export type PlanVsActualPositionRow = {
  planItemId: string | null;
  name: string;
  kategorie: OverheadCategory;
  plan: number;
  actual: number;
  delta: number;
  actuals: OverheadActual[];
};

/**
 * Plan-Positionen und Ist-Ausgaben für einen Monat gegenüberstellen.
 * Matching: `overheadItemId`, sonst gleicher Name (case-insensitive) in derselben Kategorie.
 */
export function buildPlanVsActualPositions(
  items: OverheadItem[],
  actuals: OverheadActual[],
  month: string,
  data: AppData | null = null,
): PlanVsActualPositionRow[] {
  const monthActuals = actuals.filter((a) => a.month === month);
  const usedActualIds = new Set<string>();
  const monthRange = rangeForMonthKey(month);
  const monthActivity =
    data && monthRange ? plannedActivityTotalsForRange(data, monthRange) : null;

  const rows: PlanVsActualPositionRow[] = [];

  const sortedItems = [...items].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const item of sortedItems) {
    const plan = planAmountForMonth(item, month, monthActivity);
    if (plan <= 0) continue;

    const linked = monthActuals.filter((a) => {
      if (usedActualIds.has(a.id)) return false;
      if (a.overheadItemId === item.id) return true;
      return (
        !a.overheadItemId &&
        a.kategorie === item.kategorie &&
        a.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );
    });
    for (const a of linked) usedActualIds.add(a.id);

    const actual = linked.reduce((acc, a) => acc + a.betrag, 0);
    rows.push({
      planItemId: item.id,
      name: item.name || item.id,
      kategorie: item.kategorie,
      plan,
      actual,
      delta: actual - plan,
      actuals: linked,
    });
  }

  const unmatched = monthActuals.filter((a) => !usedActualIds.has(a.id));
  const byKey = new Map<string, OverheadActual[]>();
  for (const a of unmatched) {
    const key = `${a.kategorie}::${a.name.trim().toLowerCase() || a.id}`;
    const list = byKey.get(key) ?? [];
    list.push(a);
    byKey.set(key, list);
  }
  for (const list of byKey.values()) {
    const first = list[0]!;
    const actual = list.reduce((acc, a) => acc + a.betrag, 0);
    rows.push({
      planItemId: null,
      name: first.name || "—",
      kategorie: first.kategorie,
      plan: 0,
      actual,
      delta: actual,
      actuals: list,
    });
  }

  return rows.sort((a, b) => {
    const cat = a.kategorie.localeCompare(b.kategorie);
    if (cat !== 0) return cat;
    return a.name.localeCompare(b.name);
  });
}

function deltaPercent(plan: number, actual: number): number | null {
  if (plan === 0) {
    if (actual === 0) return 0;
    return null;
  }
  return ((actual - plan) / plan) * 100;
}

/**
 * Plan (budgetierte Positionen) vs. Ist (erfasste Monatswerte) für den Zeitraum.
 * Vergleich je Kategorie und je Monat.
 */
export function buildPlanVsActual(
  items: OverheadItem[],
  actuals: OverheadActual[],
  range: DateRange,
  data: AppData | null = null,
): PlanVsActualReport {
  const months = monthsKeysInRange(range);

  const actualMap = new Map<string, number>();
  for (const a of actuals) {
    if (!months.includes(a.month)) continue;
    const key = `${a.month}:${a.kategorie}`;
    actualMap.set(key, (actualMap.get(key) ?? 0) + a.betrag);
  }

  const emptyCats = (): Record<
    OverheadCategory,
    { plan: number; actual: number }
  > => ({
    materialgemeinkosten: { plan: 0, actual: 0 },
    fertigungsgemeinkosten: { plan: 0, actual: 0 },
    verwaltungsgemeinkosten: { plan: 0, actual: 0 },
    vertriebsgemeinkosten: { plan: 0, actual: 0 },
  });

  const byMonth: PlanVsActualMonthRow[] = months.map((month) => {
    const byCategory = emptyCats();
    const monthRange = rangeForMonthKey(month);
    const monthActivity =
      data && monthRange
        ? plannedActivityTotalsForRange(data, monthRange)
        : null;
    for (const item of items) {
      const plan = planAmountForMonth(item, month, monthActivity);
      if (plan === 0) continue;
      byCategory[item.kategorie].plan += plan;
    }
    for (const kategorie of OVERHEAD_CATEGORIES) {
      byCategory[kategorie].actual =
        actualMap.get(`${month}:${kategorie}`) ?? 0;
    }
    const plan = OVERHEAD_CATEGORIES.reduce(
      (acc, k) => acc + byCategory[k].plan,
      0,
    );
    const actual = OVERHEAD_CATEGORIES.reduce(
      (acc, k) => acc + byCategory[k].actual,
      0,
    );
    return {
      month,
      plan,
      actual,
      delta: actual - plan,
      byCategory,
    };
  });

  const catTotals = emptyCats();
  for (const row of byMonth) {
    for (const k of OVERHEAD_CATEGORIES) {
      catTotals[k].plan += row.byCategory[k].plan;
      catTotals[k].actual += row.byCategory[k].actual;
    }
  }

  const byCategory: PlanVsActualCategoryRow[] = OVERHEAD_CATEGORIES.map(
    (kategorie) => {
      const plan = catTotals[kategorie].plan;
      const actual = catTotals[kategorie].actual;
      return {
        kategorie,
        plan,
        actual,
        delta: actual - plan,
        deltaPercent: deltaPercent(plan, actual),
      };
    },
  );

  const planTotal = byCategory.reduce((acc, r) => acc + r.plan, 0);
  const actualTotal = byCategory.reduce((acc, r) => acc + r.actual, 0);
  const hasActuals = actualTotal > 0 || byMonth.some((m) => m.actual > 0);

  return {
    months,
    planTotal,
    actualTotal,
    delta: actualTotal - planTotal,
    deltaPercent: deltaPercent(planTotal, actualTotal),
    byCategory,
    byMonth,
    hasActuals,
  };
}

export type OverheadTimelineGranularity = "month" | "quarter" | "year";

export type OverheadTimelineSeries = {
  id: string;
  name: string;
  kategorie: OverheadItem["kategorie"];
  data: number[];
};

export type OverheadTimeline = {
  granularity: OverheadTimelineGranularity;
  categories: string[];
  series: OverheadTimelineSeries[];
};

function chooseGranularity(monthCount: number): OverheadTimelineGranularity {
  if (monthCount <= 18) return "month";
  if (monthCount <= 48) return "quarter";
  return "year";
}

function formatBucketLabel(
  start: Date,
  granularity: OverheadTimelineGranularity,
  locale: string,
): string {
  if (granularity === "year") {
    return String(start.getFullYear());
  }
  if (granularity === "quarter") {
    const q = Math.floor(start.getMonth() / 3) + 1;
    return `Q${q} ${start.getFullYear()}`;
  }
  return start.toLocaleDateString(locale, {
    month: "short",
    year: "2-digit",
  });
}

function rangeForMonthList(
  months: Array<{ year: number; month: number }>,
): DateRange | null {
  if (months.length === 0) return null;
  const first = months[0]!;
  const last = months[months.length - 1]!;
  const from = new Date(first.year, first.month, 1);
  const to = new Date(last.year, last.month + 1, 0);
  return {
    from: toDateInputLocal(from),
    to: toDateInputLocal(to),
  };
}

/**
 * Stacked timeline of overhead costs over the selected date range.
 * Bucket size adapts to range length (month / quarter / year).
 * Each series is one overhead item; values are the prorated amount in that bucket
 * (inkl. variabeler Anteile über Stück/Umsatz, wenn `data` übergeben wird).
 */
export function buildOverheadTimeline(
  items: OverheadItem[],
  range: DateRange,
  locale = "de-DE",
  data: AppData | null = null,
): OverheadTimeline {
  const from = parseDateInput(range.from);
  const to = parseDateInput(range.to);
  const empty: OverheadTimeline = {
    granularity: "month",
    categories: [],
    series: [],
  };
  if (!from || !to || to < from) return empty;

  const monthCount = monthsInRange(range);
  if (monthCount <= 0) return empty;

  const granularity = chooseGranularity(monthCount);
  const step = granularity === "month" ? 1 : granularity === "quarter" ? 3 : 12;

  const start = monthStart(from);
  // Align quarter/year buckets to calendar boundaries
  let cursor =
    granularity === "quarter"
      ? new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1)
      : granularity === "year"
        ? new Date(start.getFullYear(), 0, 1)
        : start;

  const rangeEnd = monthStart(to);
  const categories: string[] = [];
  const bucketMonthLists: Array<Array<{ year: number; month: number }>> = [];

  while (cursor <= rangeEnd) {
    const months: Array<{ year: number; month: number }> = [];
    for (let i = 0; i < step; i++) {
      const m = addMonths(cursor, i);
      if (m >= start && m <= rangeEnd) {
        months.push({ year: m.getFullYear(), month: m.getMonth() });
      }
    }
    if (months.length > 0) {
      categories.push(formatBucketLabel(cursor, granularity, locale));
      bucketMonthLists.push(months);
    }
    cursor = addMonths(cursor, step);
    if (categories.length > 120) break;
  }

  const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
  const series: OverheadTimelineSeries[] = sorted.map((item) => ({
    id: item.id,
    name: item.name || item.id,
    kategorie: item.kategorie,
    data: bucketMonthLists.map((months) => {
      const bucketRange = rangeForMonthList(months);
      if (!bucketRange) return 0;
      const activity = data
        ? activityTotalsForRange(data, bucketRange)
        : null;
      return Math.round(amountForRange(item, bucketRange, activity) * 100) / 100;
    }),
  }));

  return { granularity, categories, series };
}

export type OverheadExportLabels = {
  sectionMeta: string;
  sectionPositions: string;
  sectionCategory: string;
  sectionProducts: string;
  sectionActuals: string;
  rangeFrom: string;
  rangeTo: string;
  exportedAt: string;
  name: string;
  amount: string;
  currency: string;
  period: string;
  category: string;
  costBehavior: string;
  allocation: string;
  periodAmount: string;
  validFrom: string;
  validTo: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
  plan: string;
  actual: string;
  delta: string;
  product: string;
  overhead: string;
  db3: string;
  after: string;
  month: string;
  labelCategory: (kategorie: OverheadItem["kategorie"]) => string;
  labelPeriod: (periode: OverheadItem["periode"]) => string;
  labelCostBehavior: (kostenart: OverheadItem["kostenart"]) => string;
  labelAllocation: (key: OverheadItem["verteilschluessel"]) => string;
};

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvEscape).join(";");
}

/**
 * Periodenauswertung als CSV (Semikolon, Excel-freundlich).
 * Enthält Meta, Plan-Positionen, Kategorie Plan/Ist, Produktverteilung, Ist-Ausgaben.
 */
export function buildOverheadPeriodCsv(
  data: AppData,
  range: DateRange,
  labels: OverheadExportLabels,
): string {
  const report = buildOverheadReport(data, range);
  const planVs = buildPlanVsActual(
    data.overheadItems ?? [],
    data.overheadActuals ?? [],
    range,
    data,
  );
  const lines: string[] = [];
  const exportedAt = new Date().toISOString();

  lines.push(labels.sectionMeta);
  lines.push(csvRow([labels.rangeFrom, range.from]));
  lines.push(csvRow([labels.rangeTo, range.to]));
  lines.push(csvRow([labels.exportedAt, exportedAt]));
  lines.push("");

  lines.push(labels.sectionPositions);
  lines.push(
    csvRow([
      labels.name,
      labels.amount,
      labels.currency,
      labels.period,
      labels.category,
      labels.costBehavior,
      labels.allocation,
      labels.periodAmount,
      labels.validFrom,
      labels.validTo,
      labels.createdAt,
      labels.updatedAt,
      labels.updatedBy,
    ]),
  );
  for (const item of report.items) {
    lines.push(
      csvRow([
        item.name,
        item.betrag,
        item.waehrung,
        labels.labelPeriod(item.periode),
        labels.labelCategory(item.kategorie),
        labels.labelCostBehavior(item.kostenart ?? "fix"),
        labels.labelAllocation(item.verteilschluessel),
        Math.round(item.periodAmount * 100) / 100,
        item.gueltigVon,
        item.gueltigBis,
        item.createdAt,
        item.updatedAt ?? item.createdAt,
        item.updatedBy,
      ]),
    );
  }
  lines.push("");

  lines.push(labels.sectionCategory);
  lines.push(
    csvRow([
      labels.category,
      labels.plan,
      labels.actual,
      labels.delta,
    ]),
  );
  for (const row of planVs.byCategory) {
    lines.push(
      csvRow([
        labels.labelCategory(row.kategorie),
        Math.round(row.plan * 100) / 100,
        Math.round(row.actual * 100) / 100,
        Math.round(row.delta * 100) / 100,
      ]),
    );
  }
  lines.push(
    csvRow([
      "Total",
      Math.round(planVs.planTotal * 100) / 100,
      Math.round(planVs.actualTotal * 100) / 100,
      Math.round(planVs.delta * 100) / 100,
    ]),
  );
  lines.push("");

  lines.push(labels.sectionProducts);
  lines.push(
    csvRow([
      labels.product,
      labels.overhead,
      labels.db3,
      labels.after,
    ]),
  );
  for (const row of report.byProduct) {
    lines.push(
      csvRow([
        row.name,
        Math.round(row.overhead * 100) / 100,
        Math.round(row.db3 * 100) / 100,
        Math.round(row.afterOverhead * 100) / 100,
      ]),
    );
  }
  lines.push("");

  lines.push(labels.sectionActuals);
  lines.push(
    csvRow([
      labels.name,
      labels.month,
      labels.category,
      labels.amount,
      labels.createdAt,
      labels.updatedAt,
      labels.updatedBy,
    ]),
  );
  const monthSet = new Set(planVs.months);
  const actuals = (data.overheadActuals ?? [])
    .filter((a) => monthSet.has(a.month))
    .sort((a, b) =>
      a.month === b.month
        ? a.name.localeCompare(b.name)
        : a.month.localeCompare(b.month),
    );
  for (const a of actuals) {
    lines.push(
      csvRow([
        a.name,
        a.month,
        labels.labelCategory(a.kategorie),
        a.betrag,
        a.createdAt,
        a.updatedAt ?? a.createdAt,
        a.updatedBy,
      ]),
    );
  }

  return lines.join("\r\n");
}

export function downloadOverheadCsv(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
