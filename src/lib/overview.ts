import type { AppData, Batch, CostItem, CostPhase, PaymentUnit } from "./types";
import { costItemTotal } from "./calc";
import { calculateResolvedEconomics, batchTimeline } from "./resolve";

const KNOWN_PHASES: CostPhase[] = ["einkauf", "transport", "lager", "vertrieb"];

export type DatePreset = "this_year" | "last_quarter" | "last_12_months" | "custom";

export type DateRange = {
  from: string; // YYYY-MM-DD
  to: string;
};

export type OverviewKpis = {
  revenue: number;
  material: number;
  logistics: number;
  marketing: number;
  sales: number;
  db1: number;
  db2: number;
  db3: number;
  marginPercent: number;
  uncategorized: number;
  batchCount: number;
};

export type OverviewWaterfallStep = {
  id: string;
  labelKey:
    | "revenue"
    | "material"
    | "db1"
    | "logistics"
    | "db2"
    | "marketing"
    | "sales"
    | "db3";
  amount: number;
  running: number;
  kind: "revenue" | "cost" | "subtotal" | "margin";
};

export type BreakdownRow = {
  id: string;
  name: string;
  revenue: number;
  db3: number;
  marginPercent: number;
  batchCount: number;
};

export type CashFlowPoint = {
  /** YYYY-MM */
  month: string;
  inflow: number;
  outflow: number;
  net: number;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function rangeForPreset(
  preset: Exclude<DatePreset, "custom">,
  now = new Date(),
): DateRange {
  const today = startOfDay(now);

  if (preset === "this_year") {
    return {
      from: toDateInput(new Date(today.getFullYear(), 0, 1)),
      to: toDateInput(new Date(today.getFullYear(), 11, 31)),
    };
  }

  if (preset === "last_quarter") {
    const quarter = Math.floor(today.getMonth() / 3);
    const prevQuarter = quarter === 0 ? 3 : quarter - 1;
    const year = quarter === 0 ? today.getFullYear() - 1 : today.getFullYear();
    const from = new Date(year, prevQuarter * 3, 1);
    const to = new Date(year, prevQuarter * 3 + 3, 0);
    return { from: toDateInput(from), to: toDateInput(to) };
  }

  // last_12_months
  const from = new Date(today);
  from.setFullYear(from.getFullYear() - 1);
  from.setDate(from.getDate() + 1);
  return { from: toDateInput(from), to: toDateInput(today) };
}

export function defaultOverviewRange(now = new Date()): DateRange {
  return rangeForPreset("this_year", now);
}

export function inRange(iso: string, range: DateRange): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const from = parseDateInput(range.from);
  const to = parseDateInput(range.to);
  if (!from || !to) return false;
  const t = d.getTime();
  return t >= startOfDay(from).getTime() && t <= endOfDay(to).getTime();
}

export function isUncategorizedCost(item: CostItem): boolean {
  return !item.phase || !KNOWN_PHASES.includes(item.phase);
}

export function isMarketingCost(item: CostItem): boolean {
  const hay = `${item.type} ${item.label}`.toLowerCase();
  return (
    hay.includes("marketing") ||
    hay.includes("cac") ||
    hay.includes("ads") ||
    hay.includes("werbung")
  );
}

function paymentDelayDays(days: number, unit: PaymentUnit): number {
  const n = Math.max(days, 0);
  return unit === "Wochen" ? n * 7 : n;
}

function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

type BatchSlice = {
  batch: Batch;
  productId: string;
  productName: string;
  supplierId: string;
  supplierName: string;
  revenue: number;
  material: number;
  logistics: number;
  marketing: number;
  sales: number;
  uncategorized: number;
  db1: number;
  db2: number;
  db3: number;
  payableAt: Date;
  soldAt: Date;
};

function sliceBatch(data: AppData, batch: Batch): BatchSlice {
  const resolved = calculateResolvedEconomics(data, batch);
  const qty = resolved.quantity;
  const goodsValue = resolved.unitPurchasePrice * qty;
  const salesValue = resolved.sellPrice * qty;

  let materialExtra = 0;
  let logistics = 0;
  let uncategorized = 0;

  for (const item of resolved.procurementItems) {
    const total = costItemTotal(item, qty, goodsValue);
    if (isUncategorizedCost(item)) {
      uncategorized += total;
      continue;
    }
    if (item.phase === "einkauf") materialExtra += total;
    else if (item.phase === "transport" || item.phase === "lager") {
      logistics += total;
    } else {
      uncategorized += total;
    }
  }

  let marketing = 0;
  let sales = 0;
  for (const item of resolved.salesItems) {
    const total = costItemTotal(item, qty, salesValue);
    if (isUncategorizedCost(item)) {
      uncategorized += total;
      continue;
    }
    if (item.phase !== "vertrieb") {
      uncategorized += total;
      continue;
    }
    if (isMarketingCost(item)) marketing += total;
    else sales += total;
  }

  const material = goodsValue + materialExtra;
  const revenue = salesValue;
  const db1 = revenue - material;
  const db2 = db1 - logistics;
  const db3 = db2 - marketing - sales;

  const timeline = batchTimeline(batch);
  const skontoApplied =
    resolved.applySkonto && resolved.skontoPercent > 0;
  const delay = paymentDelayDays(
    skontoApplied
      ? resolved.commercial.skontoDays || resolved.commercial.paymentDays
      : resolved.commercial.paymentDays,
    resolved.commercial.paymentUnit,
  );

  return {
    batch,
    productId: batch.productId,
    productName: resolved.catalogProduct?.name ?? batch.productId,
    supplierId: resolved.supplier?.id ?? batch.supplierId,
    supplierName: resolved.supplier?.name ?? batch.supplierId,
    revenue,
    material,
    logistics,
    marketing,
    sales,
    uncategorized,
    db1,
    db2,
    db3,
    payableAt: addDays(timeline.orderDate, delay),
    soldAt: new Date(timeline.soldDate),
  };
}

export type OverviewFilters = {
  /**
   * `null` / omitted = all products.
   * `[]` = none (empty report).
   * otherwise only matching product IDs.
   */
  productIds?: string[] | null;
};

export function buildOverview(
  data: AppData,
  range: DateRange,
  filters: OverviewFilters = {},
): {
  kpis: OverviewKpis;
  waterfall: OverviewWaterfallStep[];
  byProduct: BreakdownRow[];
  bySupplier: BreakdownRow[];
  cashFlow: CashFlowPoint[];
} {
  const productIds = filters.productIds;
  const productFilter =
    productIds === undefined || productIds === null
      ? null
      : new Set(productIds);

  const slices = data.batches
    .filter((b) => inRange(batchTimeline(b).soldDate, range))
    .filter((b) => (productFilter ? productFilter.has(b.productId) : true))
    .map((b) => sliceBatch(data, b));

  const sum = (pick: (s: BatchSlice) => number) =>
    slices.reduce((acc, s) => acc + pick(s), 0);

  const revenue = sum((s) => s.revenue);
  const material = sum((s) => s.material);
  const logistics = sum((s) => s.logistics);
  const marketing = sum((s) => s.marketing);
  const sales = sum((s) => s.sales);
  const uncategorized = sum((s) => s.uncategorized);
  const db1 = revenue - material;
  const db2 = db1 - logistics;
  const db3 = db2 - marketing - sales;

  const kpis: OverviewKpis = {
    revenue,
    material,
    logistics,
    marketing,
    sales,
    db1,
    db2,
    db3,
    marginPercent: revenue > 0 ? (db3 / revenue) * 100 : 0,
    uncategorized,
    batchCount: slices.length,
  };

  const waterfall: OverviewWaterfallStep[] = [
    { id: "revenue", labelKey: "revenue", amount: revenue, running: revenue, kind: "revenue" },
    { id: "material", labelKey: "material", amount: -material, running: db1, kind: "cost" },
    { id: "db1", labelKey: "db1", amount: db1, running: db1, kind: "subtotal" },
    { id: "logistics", labelKey: "logistics", amount: -logistics, running: db2, kind: "cost" },
    { id: "db2", labelKey: "db2", amount: db2, running: db2, kind: "subtotal" },
    { id: "marketing", labelKey: "marketing", amount: -marketing, running: db2 - marketing, kind: "cost" },
    { id: "sales", labelKey: "sales", amount: -sales, running: db3, kind: "cost" },
    { id: "db3", labelKey: "db3", amount: db3, running: db3, kind: "margin" },
  ];

  function aggregate(
    key: "productId" | "supplierId",
    nameKey: "productName" | "supplierName",
  ): BreakdownRow[] {
    const map = new Map<string, BreakdownRow>();
    for (const s of slices) {
      const id = s[key];
      const existing = map.get(id);
      if (!existing) {
        map.set(id, {
          id,
          name: s[nameKey],
          revenue: s.revenue,
          db3: s.db3,
          marginPercent: 0,
          batchCount: 1,
        });
      } else {
        existing.revenue += s.revenue;
        existing.db3 += s.db3;
        existing.batchCount += 1;
      }
    }
    return [...map.values()]
      .map((row) => ({
        ...row,
        marginPercent: row.revenue > 0 ? (row.db3 / row.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.db3 - a.db3);
  }

  const cashMap = new Map<string, { inflow: number; outflow: number }>();
  const bump = (month: string, field: "inflow" | "outflow", amount: number) => {
    const cur = cashMap.get(month) ?? { inflow: 0, outflow: 0 };
    cur[field] += amount;
    cashMap.set(month, cur);
  };

  for (const s of slices) {
    bump(monthKey(s.soldAt), "inflow", s.revenue);
    // Zahlungsplan: Warenwert + kategorisierte Beschaffung (Material-Extra + Logistics)
    bump(
      monthKey(s.payableAt),
      "outflow",
      s.material + s.logistics,
    );
  }

  const cashFlow: CashFlowPoint[] = [...cashMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      inflow: v.inflow,
      outflow: v.outflow,
      net: v.inflow - v.outflow,
    }));

  return {
    kpis,
    waterfall,
    byProduct: aggregate("productId", "productName"),
    bySupplier: aggregate("supplierId", "supplierName"),
    cashFlow,
  };
}

/** Fixed metric nodes in the contribution Sankey. */
export type SankeyMetricId =
  | "revenue"
  | "material"
  | "db1"
  | "logistics"
  | "db2"
  | "marketing"
  | "sales"
  | "db3";

/** @deprecated Use SankeyMetricId */
export type SankeyNodeId = SankeyMetricId;

export type ContributionSankeyNode = {
  /** Metric id or `product:<id>` */
  id: string;
  /** Display label for products; metrics use i18n in the UI */
  label?: string;
  metricId?: SankeyMetricId;
  depth: number;
  value: number;
  kind: "product" | "metric";
};

export type ContributionSankeyLink = {
  source: string;
  target: string;
  value: number;
};

export type ContributionIdentity = {
  /** Revenue = Material + DB1 */
  stage1: boolean;
  /** DB1 = Logistics + DB2 */
  stage2: boolean;
  /** DB2 = Marketing + Sales + DB3 */
  stage3: boolean;
  /** All three stages balance (within 1 cent) */
  ok: boolean;
};

const EPS = 0.02; // €0.02 float tolerance

function nearly(a: number, b: number) {
  return Math.abs(a - b) <= EPS;
}

export function productSankeyId(productId: string): string {
  return `product:${productId}`;
}

/**
 * Verifies the DB cascade identities used by waterfall + sankey.
 */
export function verifyContributionIdentity(kpis: OverviewKpis): ContributionIdentity {
  const stage1 = nearly(kpis.revenue, kpis.material + kpis.db1);
  const stage2 = nearly(kpis.db1, kpis.logistics + kpis.db2);
  const stage3 = nearly(kpis.db2, kpis.marketing + kpis.sales + kpis.db3);
  return { stage1, stage2, stage3, ok: stage1 && stage2 && stage3 };
}

/**
 * Sankey flow for contribution margin.
 *
 * When products contribute revenue, they appear left of Revenue:
 *   Product A/B/C → Revenue → Material + DB1 → …
 */
export function buildContributionSankey(
  kpis: OverviewKpis,
  products: BreakdownRow[] = [],
): {
  nodes: ContributionSankeyNode[];
  links: ContributionSankeyLink[];
} {
  const { revenue, material, logistics, marketing, sales, db1, db2, db3 } =
    kpis;

  const productSources = products
    .filter((p) => p.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const showProducts = productSources.length >= 1;
  const depthOffset = showProducts ? 1 : 0;

  const links: ContributionSankeyLink[] = [];

  if (showProducts) {
    for (const p of productSources) {
      links.push({
        source: productSankeyId(p.id),
        target: "revenue",
        value: p.revenue,
      });
    }
  }

  if (revenue > 0) {
    if (db1 > 0) {
      if (material > 0) {
        links.push({ source: "revenue", target: "material", value: material });
      }
      links.push({ source: "revenue", target: "db1", value: db1 });
    } else if (material > 0) {
      links.push({
        source: "revenue",
        target: "material",
        value: Math.min(material, revenue),
      });
    }
  }

  if (db1 > 0) {
    if (db2 > 0) {
      if (logistics > 0) {
        links.push({ source: "db1", target: "logistics", value: logistics });
      }
      links.push({ source: "db1", target: "db2", value: db2 });
    } else if (logistics > 0) {
      links.push({
        source: "db1",
        target: "logistics",
        value: Math.min(logistics, db1),
      });
    }
  }

  if (db2 > 0) {
    let remaining = db2;
    if (marketing > 0) {
      const v = Math.min(marketing, remaining);
      links.push({ source: "db2", target: "marketing", value: v });
      remaining -= v;
    }
    if (sales > 0 && remaining > 0) {
      const v = Math.min(sales, remaining);
      links.push({ source: "db2", target: "sales", value: v });
      remaining -= v;
    }
    if (db3 > 0 && remaining > 0) {
      links.push({
        source: "db2",
        target: "db3",
        value: Math.min(db3, remaining),
      });
    }
  }

  const metricDepth: Record<SankeyMetricId, number> = {
    revenue: 0 + depthOffset,
    material: 1 + depthOffset,
    db1: 1 + depthOffset,
    logistics: 2 + depthOffset,
    db2: 2 + depthOffset,
    marketing: 3 + depthOffset,
    sales: 3 + depthOffset,
    db3: 3 + depthOffset,
  };

  const metricValue: Record<SankeyMetricId, number> = {
    revenue,
    material,
    db1,
    logistics,
    db2,
    marketing,
    sales,
    db3: Math.max(db3, 0),
  };

  const used = new Set<string>();
  for (const l of links) {
    used.add(l.source);
    used.add(l.target);
  }

  const nodes: ContributionSankeyNode[] = [];

  if (showProducts) {
    for (const p of productSources) {
      const id = productSankeyId(p.id);
      if (!used.has(id)) continue;
      nodes.push({
        id,
        label: p.name,
        depth: 0,
        value: p.revenue,
        kind: "product",
      });
    }
  }

  const metricOrder: SankeyMetricId[] = [
    "revenue",
    "material",
    "db1",
    "logistics",
    "db2",
    "marketing",
    "sales",
    "db3",
  ];

  for (const mid of metricOrder) {
    if (!used.has(mid)) continue;
    nodes.push({
      id: mid,
      metricId: mid,
      depth: metricDepth[mid],
      value: metricValue[mid],
      kind: "metric",
    });
  }

  return { nodes, links };
}
