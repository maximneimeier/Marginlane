import type {
  AppData,
  Batch,
  CatalogProduct,
  CommercialOverrides,
  Component,
  CostItem,
  CommercialTerms,
  Dealer,
  ProductComponent,
  Sale,
  SalesData,
  Supplier,
} from "./types";
import { formatPaymentTerms } from "./types";
import { calculateUnitEconomics, costItemTotal } from "./calc";
import type { UnitEconomics } from "./calc";
import {
  catalogProductUnitPurchaseCost,
  primarySale,
  saleAsSalesData,
} from "./migrateAppData";
import { createId } from "./format";

export type TermSource =
  | "batch"
  | "product"
  | "component"
  | "supplier"
  | "dealer"
  | "none";

export type ResolvedField<T> = {
  value: T;
  source: TermSource;
};

export type ResolvedCommercial = CommercialTerms & {
  paymentTerms: string;
  sources: {
    currency: TermSource;
    paymentDays: TermSource;
    paymentUnit: TermSource;
    skontoPercent: TermSource;
    skontoDays: TermSource;
    incoterm: TermSource;
  };
};

function pick<T>(
  batchVal: T | null | undefined,
  productVal: T | null | undefined,
  supplierVal: T,
): ResolvedField<T> {
  if (batchVal !== null && batchVal !== undefined) {
    return { value: batchVal, source: "batch" };
  }
  if (productVal !== null && productVal !== undefined) {
    return { value: productVal, source: "product" };
  }
  return { value: supplierVal, source: "supplier" };
}

export function resolveCommercial(
  supplier: Supplier | undefined,
  product?: CommercialOverrides | null,
  batch?: CommercialOverrides | null,
): ResolvedCommercial {
  const fallback: CommercialTerms = {
    currency: supplier?.currency ?? "EUR",
    paymentDays: supplier?.paymentDays ?? 30,
    paymentUnit: supplier?.paymentUnit ?? "Tage",
    skontoPercent: supplier?.skontoPercent ?? 0,
    skontoDays: supplier?.skontoDays ?? 0,
    incoterm: supplier?.incoterm ?? "FOB",
  };

  const currency = pick(batch?.currency, product?.currency, fallback.currency);
  const paymentDays = pick(
    batch?.paymentDays,
    product?.paymentDays,
    fallback.paymentDays,
  );
  const paymentUnit = pick(
    batch?.paymentUnit,
    product?.paymentUnit,
    fallback.paymentUnit,
  );
  const skontoPercent = pick(
    batch?.skontoPercent,
    product?.skontoPercent,
    fallback.skontoPercent,
  );
  const skontoDays = pick(
    batch?.skontoDays,
    product?.skontoDays,
    fallback.skontoDays,
  );
  const incoterm = pick(batch?.incoterm, product?.incoterm, fallback.incoterm);

  const terms: CommercialTerms = {
    currency: currency.value,
    paymentDays: paymentDays.value,
    paymentUnit: paymentUnit.value,
    skontoPercent: skontoPercent.value,
    skontoDays: skontoDays.value,
    incoterm: incoterm.value,
  };

  return {
    ...terms,
    paymentTerms: formatPaymentTerms(terms),
    sources: {
      currency: currency.source,
      paymentDays: paymentDays.source,
      paymentUnit: paymentUnit.source,
      skontoPercent: skontoPercent.source,
      skontoDays: skontoDays.source,
      incoterm: incoterm.source,
    },
  };
}

/** Standardwährung ohne Lieferant / Workspace-Fallback */
export const WORKSPACE_DEFAULT_CURRENCY = "EUR";

/**
 * Komponenten-Währung: explizit gesetzt, sonst Lieferant, sonst Workspace-Default.
 * `component.currency === null` und vorhandener Lieferant → erben.
 */
export function resolveComponentCurrency(
  component: Pick<Component, "supplierId" | "currency">,
  supplier: Supplier | undefined,
): ResolvedField<string> {
  if (component.currency !== null && component.currency !== undefined) {
    return { value: component.currency, source: "component" };
  }
  if (component.supplierId && supplier?.currency) {
    return { value: supplier.currency, source: "supplier" };
  }
  return { value: WORKSPACE_DEFAULT_CURRENCY, source: "none" };
}

/** EK pro Einheit: Batch-Override oder BOM-Summe */
export function resolveUnitPurchasePrice(
  productId: string | undefined,
  components: Component[],
  productComponents: ProductComponent[],
  batch: Batch | null | undefined,
): ResolvedField<number> {
  if (
    batch?.unitPurchasePrice !== null &&
    batch?.unitPurchasePrice !== undefined
  ) {
    return { value: batch.unitPurchasePrice, source: "batch" };
  }
  if (!productId) {
    return { value: 0, source: "none" };
  }
  return {
    value: catalogProductUnitPurchaseCost(
      productId,
      components,
      productComponents,
    ),
    source: "product",
  };
}

export function resolveSalePrice(
  dealer: Dealer | undefined,
  sale: Sale,
): ResolvedField<number> {
  if (sale.salePricePerUnit !== null && sale.salePricePerUnit !== undefined) {
    return { value: sale.salePricePerUnit, source: "batch" };
  }
  if (dealer) {
    return { value: dealer.defaultSellPrice, source: "dealer" };
  }
  return { value: 0, source: "none" };
}

export function resolveSaleCostItems(
  dealer: Dealer | undefined,
  sale: Sale,
): ResolvedField<CostItem[]> {
  if (sale.costItems !== null && sale.costItems !== undefined) {
    return { value: sale.costItems, source: "batch" };
  }
  if (dealer) {
    return { value: dealer.salesCostItems, source: "dealer" };
  }
  return { value: [], source: "none" };
}

/** @deprecated Adapter für Legacy-SalesData-Aufrufe */
export function resolveSellPrice(
  dealer: Dealer | undefined,
  sales: SalesData,
): ResolvedField<number> {
  return resolveSalePrice(dealer, {
    id: "legacy",
    dealerId: sales.dealerId,
    salePricePerUnit: sales.sellPrice,
    quantity: sales.quantity,
    channel: sales.channel,
    costItems: sales.costItems,
  });
}

/** @deprecated Adapter für Legacy-SalesData-Aufrufe */
export function resolveSalesCostItems(
  dealer: Dealer | undefined,
  sales: SalesData,
): ResolvedField<CostItem[]> {
  return resolveSaleCostItems(dealer, {
    id: "legacy",
    dealerId: sales.dealerId,
    salePricePerUnit: sales.sellPrice,
    quantity: sales.quantity,
    channel: sales.channel,
    costItems: sales.costItems,
  });
}

export type ResolvedSaleRow = {
  sale: Sale;
  dealer?: Dealer;
  sellPrice: number;
  salesItems: CostItem[];
  revenue: number;
  salesCostTotal: number;
};

export function resolveBatchSales(
  data: AppData,
  batch: Batch,
): {
  rows: ResolvedSaleRow[];
  totalRevenue: number;
  totalSalesCost: number;
  soldQuantity: number;
  /** Gewichteter VK bezogen auf Batch-Menge (für Unit Economics) */
  effectiveSellPrice: number;
} {
  const rows: ResolvedSaleRow[] = [];
  let totalRevenue = 0;
  let totalSalesCost = 0;
  let soldQuantity = 0;

  for (const sale of batch.sales) {
    const dealer = data.dealers.find((d) => d.id === (sale.dealerId ?? ""));
    const sell = resolveSalePrice(dealer, sale);
    const items = resolveSaleCostItems(dealer, sale);
    const qty = Math.max(sale.quantity, 0);
    const revenue = sell.value * qty;
    let salesCostTotal = 0;
    for (const item of items.value) {
      salesCostTotal += costItemTotal(item, qty, revenue);
    }
    rows.push({
      sale,
      dealer,
      sellPrice: sell.value,
      salesItems: items.value,
      revenue,
      salesCostTotal,
    });
    totalRevenue += revenue;
    totalSalesCost += salesCostTotal;
    soldQuantity += qty;
  }

  const batchQty = Math.max(batch.quantity, 0);
  const effectiveSellPrice =
    batchQty > 0 ? totalRevenue / batchQty : totalRevenue;

  return {
    rows,
    totalRevenue,
    totalSalesCost,
    soldQuantity,
    effectiveSellPrice,
  };
}

export function resolveBatchEconomicsInput(
  data: AppData,
  batch: Batch,
): {
  quantity: number;
  unitPurchasePrice: number;
  procurementItems: CostItem[];
  sellPrice: number;
  salesItems: CostItem[];
  commercial: ResolvedCommercial;
  catalogProduct?: CatalogProduct;
  components: Component[];
  supplier?: Supplier;
  dealer?: Dealer;
  salesAggregate: ReturnType<typeof resolveBatchSales>;
} {
  const catalogProduct = data.catalogProducts.find(
    (p) => p.id === batch.productId,
  );
  const links = (data.productComponents ?? []).filter(
    (pc) => pc.productId === batch.productId,
  );
  const linkComponentIds = new Set(links.map((pc) => pc.componentId));
  const components = data.components.filter((c) =>
    linkComponentIds.has(c.id),
  );
  const primarySupplierId =
    batch.supplierId ||
    components.find((c) => c.supplierId)?.supplierId ||
    "";
  const supplier = data.suppliers.find((s) => s.id === primarySupplierId);
  const salesAggregate = resolveBatchSales(data, batch);
  const firstSale = primarySale(batch);
  const dealer = data.dealers.find(
    (d) => d.id === (firstSale?.dealerId ?? ""),
  );
  const commercial = resolveCommercial(supplier, null, batch);
  const purchase = resolveUnitPurchasePrice(
    batch.productId,
    data.components,
    data.productComponents ?? [],
    batch,
  );

  // Vertriebskosten als eine Pauschale, damit % vom Warenwert pro Sale korrekt bleiben
  const aggregatedSalesItems: CostItem[] =
    salesAggregate.totalSalesCost > 0
      ? [
          {
            id: createId("cost"),
            type: "Vertriebskosten",
            label: "Vertriebskosten (Summe Sales)",
            amount: salesAggregate.totalSalesCost,
            allocation: "lump_sum",
            phase: "vertrieb",
          },
        ]
      : [];

  return {
    quantity: batch.quantity,
    unitPurchasePrice: purchase.value,
    procurementItems: batch.costItems,
    sellPrice: salesAggregate.effectiveSellPrice,
    salesItems: aggregatedSalesItems,
    commercial,
    catalogProduct,
    components,
    supplier,
    dealer,
    salesAggregate,
  };
}

export const emptyCommercialOverrides = (): CommercialOverrides => ({
  currency: null,
  paymentDays: null,
  paymentUnit: null,
  skontoPercent: null,
  skontoDays: null,
  incoterm: null,
});

/** Unit Economics mit Inheritance (Batch → BOM / Supplier / Dealer) */
export function calculateResolvedEconomics(
  data: AppData,
  batch: Batch,
): UnitEconomics & ReturnType<typeof resolveBatchEconomicsInput> {
  const resolved = resolveBatchEconomicsInput(data, batch);
  const econ = calculateUnitEconomics({
    quantity: resolved.quantity,
    unitPurchasePrice: resolved.unitPurchasePrice,
    procurementItems: resolved.procurementItems,
    sellPrice: resolved.sellPrice,
    salesItems: resolved.salesItems,
  });

  // Detaillierte Sales-Breakdown aus den einzelnen Sales ersetzen
  const salesBreakdown = resolved.salesAggregate.rows.flatMap((row) =>
    row.salesItems.map((item) => ({
      item,
      perUnit:
        resolved.quantity > 0
          ? costItemTotal(item, row.sale.quantity, row.revenue) /
            resolved.quantity
          : 0,
      total: costItemTotal(item, row.sale.quantity, row.revenue),
    })),
  );

  return {
    ...resolved,
    ...econ,
    salesBreakdown,
    salesCostsPerUnit:
      resolved.quantity > 0
        ? resolved.salesAggregate.totalSalesCost / resolved.quantity
        : 0,
    contributionPerUnit:
      econ.sellPrice -
      econ.landedCostPerUnit -
      (resolved.quantity > 0
        ? resolved.salesAggregate.totalSalesCost / resolved.quantity
        : 0),
  };
}

export { saleAsSalesData, primarySale };
