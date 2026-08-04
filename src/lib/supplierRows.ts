import type { AppData, Supplier, SupplierStatus } from "./types";
import { calculateUnitEconomics } from "./calc";

export type SupplierRow = {
  supplier: Supplier;
  productCount: number;
  avgLandedCost: number | null;
  lastOrderAt: string | null;
};

export function buildSupplierRows(data: AppData): SupplierRow[] {
  return data.suppliers.map((supplier) => {
    const products = data.products.filter((p) => p.supplierId === supplier.id);
    const batches = data.batches.filter((b) => b.supplierId === supplier.id);

    let avgLandedCost: number | null = null;
    if (batches.length > 0) {
      const sum = batches.reduce((acc, batch) => {
        const econ = calculateUnitEconomics({
          quantity: batch.quantity,
          unitPurchasePrice: batch.unitPurchasePrice,
          procurementItems: batch.costItems,
          sellPrice: batch.sales.sellPrice,
          salesItems: batch.sales.costItems,
        });
        return acc + econ.landedCostPerUnit;
      }, 0);
      avgLandedCost = sum / batches.length;
    }

    const lastOrderAt =
      batches.length === 0
        ? null
        : batches
            .map((b) => b.createdAt)
            .sort((a, b) => b.localeCompare(a))[0] ?? null;

    return {
      supplier,
      productCount: products.length,
      avgLandedCost,
      lastOrderAt,
    };
  });
}

export type SortKey =
  | "name"
  | "country"
  | "productCount"
  | "avgLandedCost"
  | "lastOrderAt"
  | "incoterm"
  | "status"
  | "contactName"
  | "paymentDays"
  | "skonto"
  | "taxId";

export type OptionalColumn = "contactName" | "paymentDays" | "skonto" | "taxId";

export const OPTIONAL_COLUMN_LABELS: Record<OptionalColumn, string> = {
  contactName: "Ansprechpartner",
  paymentDays: "Zahlungsziel",
  skonto: "Skonto",
  taxId: "USt-IdNr.",
};

export function sortRows(
  rows: SupplierRow[],
  key: SortKey,
  dir: "asc" | "desc",
): SupplierRow[] {
  const mult = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    if (av === bv) return 0;
    if (av === null || av === undefined || av === "") return 1;
    if (bv === null || bv === undefined || bv === "") return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return (av - bv) * mult;
    }
    return String(av).localeCompare(String(bv), "de") * mult;
  });
}

function sortValue(row: SupplierRow, key: SortKey): string | number | null {
  switch (key) {
    case "name":
      return row.supplier.name.toLowerCase();
    case "country":
      return row.supplier.country;
    case "productCount":
      return row.productCount;
    case "avgLandedCost":
      return row.avgLandedCost;
    case "lastOrderAt":
      return row.lastOrderAt;
    case "incoterm":
      return row.supplier.incoterm;
    case "status":
      return statusRank(row.supplier.status);
    case "contactName":
      return row.supplier.contactName.toLowerCase();
    case "paymentDays":
      return paymentDaysInDays(row.supplier);
    case "skonto":
      return row.supplier.skontoPercent;
    case "taxId":
      return row.supplier.taxId;
  }
}

function statusRank(status: SupplierStatus): number {
  if (status === "active") return 0;
  if (status === "review") return 1;
  return 2;
}

function paymentDaysInDays(s: Supplier): number {
  return s.paymentUnit === "Wochen" ? s.paymentDays * 7 : s.paymentDays;
}

export function formatDateDe(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export type ProductMetrics = {
  productId: string;
  batchCount: number;
  avgLandedCost: number | null;
  lastOrderAt: string | null;
  avgMarginEuro: number | null;
  avgMarginPercent: number | null;
};

export function buildProductMetrics(
  productId: string,
  batches: AppData["batches"],
): ProductMetrics {
  const related = batches.filter((b) => b.productId === productId);
  if (related.length === 0) {
    return {
      productId,
      batchCount: 0,
      avgLandedCost: null,
      lastOrderAt: null,
      avgMarginEuro: null,
      avgMarginPercent: null,
    };
  }

  let landedSum = 0;
  let marginSum = 0;
  let marginPctSum = 0;
  let soldCount = 0;

  for (const batch of related) {
    const econ = calculateUnitEconomics({
      quantity: batch.quantity,
      unitPurchasePrice: batch.unitPurchasePrice,
      procurementItems: batch.costItems,
      sellPrice: batch.sales.sellPrice,
      salesItems: batch.sales.costItems,
    });
    landedSum += econ.landedCostPerUnit;
    if (batch.sales.sellPrice > 0) {
      marginSum += econ.contributionPerUnit;
      marginPctSum += econ.contributionPercent;
      soldCount += 1;
    }
  }

  const lastOrderAt =
    related.map((b) => b.createdAt).sort((a, b) => b.localeCompare(a))[0] ??
    null;

  return {
    productId,
    batchCount: related.length,
    avgLandedCost: landedSum / related.length,
    lastOrderAt,
    avgMarginEuro: soldCount > 0 ? marginSum / soldCount : null,
    avgMarginPercent: soldCount > 0 ? marginPctSum / soldCount : null,
  };
}
