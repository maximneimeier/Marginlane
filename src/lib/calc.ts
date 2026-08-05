import type { CostItem } from "./types";

/** Total cost of one cost item for a given batch quantity & goods value */
export function costItemTotal(
  item: CostItem,
  quantity: number,
  goodsValue: number,
): number {
  const qty = Math.max(quantity, 0);
  switch (item.allocation) {
    case "per_unit":
      return item.amount * qty;
    case "lump_sum":
      return item.amount;
    case "percent_of_goods":
      return (item.amount / 100) * goodsValue;
    default:
      return 0;
  }
}

/** Per-unit share of one cost item */
export function costItemPerUnit(
  item: CostItem,
  quantity: number,
  goodsValue: number,
): number {
  const qty = Math.max(quantity, 0);
  if (qty === 0) return 0;
  return costItemTotal(item, qty, goodsValue) / qty;
}

export type WaterfallStep = {
  id: string;
  label: string;
  phase?: string;
  amountPerUnit: number;
  runningTotal: number;
  kind: "base" | "cost" | "subtotal" | "revenue" | "margin";
};

export type UnitEconomics = {
  goodsValue: number;
  purchasePerUnit: number;
  procurementCostsPerUnit: number;
  landedCostPerUnit: number;
  sellPrice: number;
  salesCostsPerUnit: number;
  contributionPerUnit: number;
  contributionPercent: number;
  waterfall: WaterfallStep[];
  procurementBreakdown: { item: CostItem; perUnit: number; total: number }[];
  salesBreakdown: { item: CostItem; perUnit: number; total: number }[];
};

/**
 * quantity und unitPurchasePrice/sellPrice sind in der Preisenheit des Produkts
 * (Stück, Gramm, …) — siehe Product.pricingUnit.
 */
export function calculateUnitEconomics(input: {
  quantity: number;
  unitPurchasePrice: number;
  procurementItems: CostItem[];
  sellPrice: number;
  salesItems: CostItem[];
}): UnitEconomics {
  const quantity = Math.max(input.quantity, 0);
  const purchasePerUnit = input.unitPurchasePrice;
  const goodsValue = purchasePerUnit * quantity;

  const procurementBreakdown = input.procurementItems.map((item) => ({
    item,
    perUnit: costItemPerUnit(item, quantity, goodsValue),
    total: costItemTotal(item, quantity, goodsValue),
  }));

  const procurementCostsPerUnit = procurementBreakdown.reduce(
    (s, row) => s + row.perUnit,
    0,
  );
  const landedCostPerUnit = purchasePerUnit + procurementCostsPerUnit;

  // Vertrieb: "% vom Warenwert" bezieht sich auf den Verkaufserlös
  const salesValue = input.sellPrice * quantity;
  const salesBreakdown = input.salesItems.map((item) => ({
    item,
    perUnit: costItemPerUnit(item, quantity, salesValue),
    total: costItemTotal(item, quantity, salesValue),
  }));

  const salesCostsPerUnit = salesBreakdown.reduce((s, row) => s + row.perUnit, 0);
  const sellPrice = input.sellPrice;
  const contributionPerUnit =
    sellPrice - landedCostPerUnit - salesCostsPerUnit;
  const contributionPercent =
    sellPrice > 0 ? (contributionPerUnit / sellPrice) * 100 : 0;

  const waterfall: WaterfallStep[] = [];
  let running = purchasePerUnit;

  waterfall.push({
    id: "purchase",
    label: "Einkaufspreis",
    amountPerUnit: purchasePerUnit,
    runningTotal: running,
    kind: "base",
  });

  for (const row of procurementBreakdown) {
    running += row.perUnit;
    waterfall.push({
      id: row.item.id,
      label: row.item.label || row.item.type,
      phase: row.item.phase,
      amountPerUnit: row.perUnit,
      runningTotal: running,
      kind: "cost",
    });
  }

  waterfall.push({
    id: "landed",
    label: "Landed Cost",
    amountPerUnit: landedCostPerUnit,
    runningTotal: landedCostPerUnit,
    kind: "subtotal",
  });

  running = landedCostPerUnit;
  for (const row of salesBreakdown) {
    running += row.perUnit;
    waterfall.push({
      id: row.item.id,
      label: row.item.label || row.item.type,
      phase: row.item.phase,
      amountPerUnit: row.perUnit,
      runningTotal: running,
      kind: "cost",
    });
  }

  waterfall.push({
    id: "revenue",
    label: "Verkaufspreis",
    amountPerUnit: sellPrice,
    runningTotal: sellPrice,
    kind: "revenue",
  });

  waterfall.push({
    id: "margin",
    label: "Nettomarge / Einheit",
    amountPerUnit: contributionPerUnit,
    runningTotal: contributionPerUnit,
    kind: "margin",
  });

  return {
    goodsValue,
    purchasePerUnit,
    procurementCostsPerUnit,
    landedCostPerUnit,
    sellPrice,
    salesCostsPerUnit,
    contributionPerUnit,
    contributionPercent,
    waterfall,
    procurementBreakdown,
    salesBreakdown,
  };
}

/** Apply discount tiers: highest matching minQty wins */
export function effectiveUnitPrice(
  basePrice: number,
  quantity: number,
  tiers: { minQty: number; discountPercent: number }[],
): number {
  return resolvePurchasePrice(basePrice, quantity, tiers).unitPrice;
}

/** Listenpreis + greifende Rabattstaffel für die angegebene Menge */
export function resolvePurchasePrice(
  basePrice: number,
  quantity: number,
  tiers: { minQty: number; discountPercent: number }[],
): {
  listPrice: number;
  unitPrice: number;
  discountPercent: number;
  tierMinQty: number | null;
  savingsPerUnit: number;
} {
  const applicable = [...tiers]
    .filter((t) => quantity >= t.minQty)
    .sort((a, b) => b.minQty - a.minQty)[0];

  if (!applicable) {
    return {
      listPrice: basePrice,
      unitPrice: basePrice,
      discountPercent: 0,
      tierMinQty: null,
      savingsPerUnit: 0,
    };
  }

  const unitPrice = basePrice * (1 - applicable.discountPercent / 100);
  return {
    listPrice: basePrice,
    unitPrice,
    discountPercent: applicable.discountPercent,
    tierMinQty: applicable.minQty,
    savingsPerUnit: basePrice - unitPrice,
  };
}
