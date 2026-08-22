import type { AppData, Batch } from "./types";
import { calculateResolvedEconomics } from "./resolve";
import {
  getBatchPipelineStatusForData,
  isFinishedGoodsBatch,
  isPartBatch,
  todayIsoDate,
} from "./batchPipeline";
import {
  productOnHandQuantity,
  reservedComponentDemand,
  resolveComponentStockProductId,
} from "./production";

export type InventoryStockScope = "finished" | "parts";

export type InventoryOverviewKpis = {
  stockValue: number;
  capitalTied: number;
  avgLandedPerUnit: number;
  openReceipts: number;
  overdueReceipts: number;
};

export type InventoryProductValueBar = {
  productId: string;
  name: string;
  stockValue: number;
};

/** Bestand eines Einzelteils (Komponente mit Lagerartikel) */
export type InventoryComponentStockBar = {
  componentId: string;
  name: string;
  /** Physisch im Lager */
  onHand: number;
  /** Durch geplante Produktion reserviert */
  reserved: number;
  /** frei = max(onHand − reserved, 0) */
  free: number;
  /** Lagerwert (Landed) der Restmenge */
  stockValue: number;
};

export type InventoryPipelineMix = {
  ordered: number;
  in_transit: number;
  arrived: number;
};

export type InventoryArrivalFidelityRow = {
  batchId: string;
  label: string;
  eta: string;
  actual: string | null;
  deltaDays: number | null;
  overdue: boolean;
};

export type InventoryStockTrendPoint = {
  date: string;
  value: number;
};

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a.slice(0, 10)}T12:00:00`);
  const db = new Date(`${b.slice(0, 10)}T12:00:00`);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

function batchLandedTotal(data: AppData, batch: Batch): number {
  const econ = calculateResolvedEconomics(data, batch);
  return econ.landedCostPerUnit * batch.quantity;
}

function productOnHandValue(
  data: AppData,
  productId: string,
  today: string,
): number {
  if (!productId) return 0;
  let sum = 0;
  for (const batch of data.batches) {
    if (batch.productId !== productId) continue;
    const status = getBatchPipelineStatusForData(data, batch, today);
    if (status !== "arrived") continue;
    const econ = calculateResolvedEconomics(data, batch);
    sum += econ.landedCostPerUnit * econ.remainingQuantity;
  }
  return sum;
}

function batchInScope(
  data: AppData,
  batch: Batch,
  scope: InventoryStockScope,
): boolean {
  return scope === "parts"
    ? isPartBatch(data, batch)
    : isFinishedGoodsBatch(data, batch);
}

export type InventoryStockTrendFilterOption = {
  /** Komponenten-ID */
  componentId: string;
  name: string;
  /** Katalogprodukt, dessen Chargen den Teilebestand halten */
  stockProductId: string;
};

/** Alle Lagerartikel-IDs, die an Komponenten hängen */
export function componentStockProductIds(
  data: Pick<AppData, "catalogProducts" | "components">,
): Set<string> {
  const ids = new Set<string>();
  for (const component of data.components ?? []) {
    const stockId = resolveComponentStockProductId(data, component);
    if (stockId) ids.add(stockId);
  }
  return ids;
}

/**
 * Kumulativer Lagerwert nach Wareneingang.
 * `scope = parts` + optional `filterComponentId`;
 * `scope = finished` → nur Fertigware-Chargen.
 */
export function buildInventoryStockTrend(
  data: AppData,
  filterComponentId: string | null = null,
  today: string = todayIsoDate(),
  scope: InventoryStockScope = "parts",
): InventoryStockTrendPoint[] {
  let allowedProductIds: Set<string> | null = null;

  if (scope === "parts") {
    allowedProductIds = componentStockProductIds(data);
    if (filterComponentId) {
      const component = data.components.find((c) => c.id === filterComponentId);
      const stockId = resolveComponentStockProductId(data, component);
      allowedProductIds = stockId ? new Set([stockId]) : new Set();
    }
  }

  const arrivalEvents: { date: string; value: number }[] = [];

  for (const batch of data.batches) {
    if (!batch.productId) continue;
    if (scope === "parts") {
      if (!allowedProductIds!.has(batch.productId)) continue;
    } else if (!isFinishedGoodsBatch(data, batch)) {
      continue;
    }
    const arrivedOn = batch.arrivalDate?.slice(0, 10) || null;
    if (!arrivedOn || arrivedOn > today) continue;
    arrivalEvents.push({
      date: arrivedOn,
      value: batchLandedTotal(data, batch),
    });
  }

  arrivalEvents.sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  const stockTrend: InventoryStockTrendPoint[] = [];
  for (const ev of arrivalEvents) {
    running += ev.value;
    const last = stockTrend[stockTrend.length - 1];
    if (last && last.date === ev.date) {
      last.value = running;
    } else {
      stockTrend.push({ date: ev.date, value: running });
    }
  }
  return stockTrend;
}

/** Komponenten mit Lagerartikel und mindestens einem Wareneingang */
export function inventoryStockTrendComponents(
  data: AppData,
  today: string = todayIsoDate(),
): InventoryStockTrendFilterOption[] {
  const options: InventoryStockTrendFilterOption[] = [];
  for (const component of data.components ?? []) {
    const stockProductId = resolveComponentStockProductId(data, component);
    if (!stockProductId) continue;
    const hasArrival = data.batches.some((batch) => {
      if (batch.productId !== stockProductId) return false;
      const arrivedOn = batch.arrivalDate?.slice(0, 10) || null;
      return Boolean(arrivedOn && arrivedOn <= today);
    });
    if (!hasArrival) continue;
    options.push({
      componentId: component.id,
      name: component.name || "—",
      stockProductId,
    });
  }
  return options.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildInventoryOverview(
  data: AppData,
  today: string = todayIsoDate(),
  scope: InventoryStockScope = "finished",
): {
  kpis: InventoryOverviewKpis;
  productBars: InventoryProductValueBar[];
  componentBars: InventoryComponentStockBar[];
  pipelineMix: InventoryPipelineMix;
  fidelity: InventoryArrivalFidelityRow[];
  stockTrend: InventoryStockTrendPoint[];
  stockTrendComponents: InventoryStockTrendFilterOption[];
} {
  let stockValue = 0;
  let capitalTied = 0;
  let landedWeighted = 0;
  let qtyWeighted = 0;
  let openReceipts = 0;
  let overdueReceipts = 0;

  const pipelineMix: InventoryPipelineMix = {
    ordered: 0,
    in_transit: 0,
    arrived: 0,
  };

  const productMap = new Map<string, InventoryProductValueBar>();
  const fidelity: InventoryArrivalFidelityRow[] = [];

  for (const batch of data.batches) {
    if (!batchInScope(data, batch, scope)) continue;

    const status = getBatchPipelineStatusForData(data, batch, today);
    if (status === "sold") continue;

    const econ = calculateResolvedEconomics(data, batch);
    const landed = econ.landedCostPerUnit;
    const total = landed * batch.quantity;
    const product = data.catalogProducts.find((p) => p.id === batch.productId);
    const productId = batch.productId || "__none__";
    const productName = product?.name ?? "—";

    if (status === "ordered" || status === "in_transit") {
      capitalTied += total;
      openReceipts += 1;
      pipelineMix[status] += total;
      landedWeighted += total;
      qtyWeighted += batch.quantity;

      const eta = batch.expectedArrivalDate?.slice(0, 10) || null;
      if (eta && eta < today && !batch.arrivalDate) {
        overdueReceipts += 1;
      }
    } else if (status === "arrived") {
      const value = landed * econ.remainingQuantity;
      stockValue += value;
      pipelineMix.arrived += value;
      landedWeighted += landed * econ.remainingQuantity;
      qtyWeighted += econ.remainingQuantity;

      const bar = productMap.get(productId) ?? {
        productId,
        name: productName,
        stockValue: 0,
      };
      bar.stockValue += value;
      productMap.set(productId, bar);
    }

    const eta = batch.expectedArrivalDate?.slice(0, 10) || null;
    const actual = batch.arrivalDate?.slice(0, 10) || null;
    if (eta) {
      fidelity.push({
        batchId: batch.id,
        label: batch.label,
        eta,
        actual,
        deltaDays: actual ? daysBetween(eta, actual) : null,
        overdue: !actual && eta < today,
      });
    }
  }

  fidelity.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return (b.actual || b.eta).localeCompare(a.actual || a.eta);
  });

  const productBars = [...productMap.values()]
    .filter((r) => r.stockValue > 0)
    .sort((a, b) => b.stockValue - a.stockValue)
    .slice(0, 8);

  const componentBars: InventoryComponentStockBar[] = [];
  if (scope === "parts") {
    for (const component of data.components ?? []) {
      const stockProductId = resolveComponentStockProductId(data, component);
      if (!stockProductId) continue;
      const onHand = productOnHandQuantity(data, stockProductId, today);
      const reserved = reservedComponentDemand(data, component.id);
      if (onHand <= 0 && reserved <= 0) continue;
      const free = Math.max(onHand - reserved, 0);
      componentBars.push({
        componentId: component.id,
        name: component.name || "—",
        onHand,
        reserved,
        free,
        stockValue: productOnHandValue(data, stockProductId, today),
      });
    }
    componentBars.sort(
      (a, b) => b.stockValue - a.stockValue || b.onHand - a.onHand,
    );
  }

  return {
    kpis: {
      stockValue,
      capitalTied,
      avgLandedPerUnit: qtyWeighted > 0 ? landedWeighted / qtyWeighted : 0,
      openReceipts,
      overdueReceipts,
    },
    productBars: scope === "finished" ? productBars : [],
    componentBars: componentBars.slice(0, 10),
    pipelineMix,
    fidelity: fidelity.slice(0, 12),
    stockTrend: buildInventoryStockTrend(
      data,
      null,
      today,
      scope === "parts" ? "parts" : "finished",
    ),
    stockTrendComponents:
      scope === "parts" ? inventoryStockTrendComponents(data, today) : [],
  };
}
