import type {
  AppData,
  Batch,
  CommercialOverrides,
  CostItem,
  CommercialTerms,
  Dealer,
  Product,
  SalesData,
  Supplier,
} from "./types";
import { formatPaymentTerms } from "./types";
import { calculateUnitEconomics, effectiveUnitPrice } from "./calc";
import type { UnitEconomics } from "./calc";

export type TermSource = "batch" | "product" | "supplier" | "dealer" | "none";

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
  product?: Product | null,
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

export function resolveUnitPurchasePrice(
  product: Product | undefined,
  batch: Batch | null | undefined,
  quantity: number,
): ResolvedField<number> {
  if (batch?.unitPurchasePrice !== null && batch?.unitPurchasePrice !== undefined) {
    return { value: batch.unitPurchasePrice, source: "batch" };
  }
  if (!product) {
    return { value: 0, source: "none" };
  }
  return {
    value: effectiveUnitPrice(
      product.unitPrice,
      quantity,
      product.discountTiers,
    ),
    source: "product",
  };
}

export function resolveSellPrice(
  dealer: Dealer | undefined,
  sales: SalesData,
): ResolvedField<number> {
  if (sales.sellPrice !== null && sales.sellPrice !== undefined) {
    return { value: sales.sellPrice, source: "batch" };
  }
  if (dealer) {
    return { value: dealer.defaultSellPrice, source: "dealer" };
  }
  return { value: 0, source: "none" };
}

export function resolveSalesCostItems(
  dealer: Dealer | undefined,
  sales: SalesData,
): ResolvedField<CostItem[]> {
  if (sales.costItems !== null && sales.costItems !== undefined) {
    return { value: sales.costItems, source: "batch" };
  }
  if (dealer) {
    return { value: dealer.salesCostItems, source: "dealer" };
  }
  return { value: [], source: "none" };
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
  product?: Product;
  supplier?: Supplier;
  dealer?: Dealer;
} {
  const product = data.products.find((p) => p.id === batch.productId);
  const supplier =
    data.suppliers.find((s) => s.id === batch.supplierId) ??
    data.suppliers.find((s) => s.id === product?.supplierId);
  const dealer = data.dealers.find((d) => d.id === (batch.sales.dealerId ?? ""));
  const commercial = resolveCommercial(supplier, product, batch);
  const purchase = resolveUnitPurchasePrice(product, batch, batch.quantity);
  const sell = resolveSellPrice(dealer, batch.sales);
  const salesItems = resolveSalesCostItems(dealer, batch.sales);

  return {
    quantity: batch.quantity,
    unitPurchasePrice: purchase.value,
    procurementItems: batch.costItems,
    sellPrice: sell.value,
    salesItems: salesItems.value,
    commercial,
    product,
    supplier,
    dealer,
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

/** Unit Economics mit Inheritance (Batch → Product → Supplier / Dealer) */
export function calculateResolvedEconomics(
  data: AppData,
  batch: Batch,
): UnitEconomics & ReturnType<typeof resolveBatchEconomicsInput> {
  const resolved = resolveBatchEconomicsInput(data, batch);
  return {
    ...resolved,
    ...calculateUnitEconomics({
      quantity: resolved.quantity,
      unitPurchasePrice: resolved.unitPurchasePrice,
      procurementItems: resolved.procurementItems,
      sellPrice: resolved.sellPrice,
      salesItems: resolved.salesItems,
    }),
  };
}
