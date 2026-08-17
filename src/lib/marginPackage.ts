import type { AppData, Batch } from "./types";
import {
  batchOverheadShare,
  getBatchContribution,
} from "./batchContribution";
import { defaultOverviewRange, isMarketingCost, type DateRange } from "./overview";
import { costItemTotal } from "./calc";
import { calculateResolvedEconomics } from "./resolve";

export type MarginPackageSaleLine = {
  index: number;
  dealerName: string;
  channel: string;
  quantity: number;
  sellPricePerUnit: number;
  revenue: number;
  marketing: number;
  sales: number;
};

export type MarginPackageReport = {
  generatedAt: string;
  companyName: string;
  currency: string;
  batchId: string;
  batchLabel: string;
  productName: string;
  productSku: string;
  pricingUnit: string;
  quantity: number;
  supplierName: string;
  supplierCountry: string;
  dealerNames: string[];
  activeQuoteLabel: string | null;
  purchasePerUnit: number;
  landedCostPerUnit: number;
  sellPricePerUnit: number;
  revenue: number;
  material: number;
  logistics: number;
  marketing: number;
  sales: number;
  db1: number;
  db2: number;
  db3: number;
  db1PerUnit: number;
  db2PerUnit: number;
  db3PerUnit: number;
  marginPercent: number;
  overheadShare: number;
  afterOverhead: number | null;
  afterOverheadPerUnit: number | null;
  salesLines: MarginPackageSaleLine[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function perUnit(total: number, qty: number): number {
  return qty > 0 ? round2(total / qty) : 0;
}

/** Vertrauens-Report für eine Charge (DB1–DB3, Partner, Nach Gemeinkosten). */
export function buildMarginPackage(
  data: AppData,
  batch: Batch,
  range: DateRange = defaultOverviewRange(),
): MarginPackageReport {
  const econ = calculateResolvedEconomics(data, batch);
  const contrib = getBatchContribution(data, batch);
  const qty = Math.max(batch.quantity, 0);
  const ohShare = batchOverheadShare(data, batch, range);
  const afterOh = ohShare > 0 ? round2(contrib.db3 - ohShare) : null;

  const dealerNames = [
    ...new Map(
      econ.salesAggregate.rows
        .map((r) => r.dealer)
        .filter((d): d is NonNullable<typeof d> => Boolean(d))
        .map((d) => [d.id, d.name] as const),
    ).values(),
  ];

  const activeQuote =
    batch.activeQuoteId != null
      ? (batch.quotes ?? []).find((q) => q.id === batch.activeQuoteId)
      : null;

  const salesLines: MarginPackageSaleLine[] = econ.salesAggregate.rows.map(
    (row, index) => {
      let marketing = 0;
      let sales = 0;
      for (const item of row.salesItems) {
        const total = costItemTotal(item, row.sale.quantity, row.revenue);
        if (isMarketingCost(item)) marketing += total;
        else sales += total;
      }
      return {
        index: index + 1,
        dealerName: row.dealer?.name ?? "",
        channel: row.sale.channel || "",
        quantity: row.sale.quantity,
        sellPricePerUnit: round2(row.sellPrice),
        revenue: round2(row.revenue),
        marketing: round2(marketing),
        sales: round2(sales),
      };
    },
  );

  return {
    generatedAt: new Date().toISOString(),
    companyName: data.companySettings.companyName || "Costerra",
    currency: econ.baseCurrency || "EUR",
    batchId: batch.id,
    batchLabel: batch.label,
    productName: contrib.productName,
    productSku: econ.catalogProduct?.sku ?? "",
    pricingUnit: econ.catalogProduct?.pricingUnit ?? "pcs",
    quantity: qty,
    supplierName: contrib.supplierName,
    supplierCountry: econ.supplier?.country ?? "",
    dealerNames,
    activeQuoteLabel: activeQuote?.label ?? null,
    purchasePerUnit: round2(econ.purchasePerUnit),
    landedCostPerUnit: round2(econ.landedCostPerUnit),
    sellPricePerUnit: round2(econ.sellPrice),
    revenue: round2(contrib.revenue),
    material: round2(contrib.material),
    logistics: round2(contrib.logistics),
    marketing: round2(contrib.marketing),
    sales: round2(contrib.sales),
    db1: round2(contrib.db1),
    db2: round2(contrib.db2),
    db3: round2(contrib.db3),
    db1PerUnit: perUnit(contrib.db1, qty),
    db2PerUnit: perUnit(contrib.db2, qty),
    db3PerUnit: perUnit(contrib.db3, qty),
    marginPercent:
      contrib.revenue > 0
        ? round2((contrib.db3 / contrib.revenue) * 100)
        : 0,
    overheadShare: round2(ohShare),
    afterOverhead: afterOh,
    afterOverheadPerUnit:
      afterOh != null ? perUnit(afterOh, qty) : null,
    salesLines,
  };
}

export function buildMarginPackages(
  data: AppData,
  range: DateRange = defaultOverviewRange(),
): MarginPackageReport[] {
  return data.batches.map((batch) => buildMarginPackage(data, batch, range));
}

export function sanitizeFilenamePart(value: string): string {
  return (
    value
      .trim()
      .replace(/[^\w\-äöüÄÖÜß]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 48) || "charge"
  );
}
