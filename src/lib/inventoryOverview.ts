import type { AppData, Batch } from "./types";
import { calculateResolvedEconomics } from "./resolve";
import {
  getBatchPipelineStatusForData,
  todayIsoDate,
} from "./batchPipeline";

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

export function buildInventoryOverview(
  data: AppData,
  today: string = todayIsoDate(),
): {
  kpis: InventoryOverviewKpis;
  productBars: InventoryProductValueBar[];
  pipelineMix: InventoryPipelineMix;
  fidelity: InventoryArrivalFidelityRow[];
  stockTrend: InventoryStockTrendPoint[];
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
  const arrivalEvents: { date: string; value: number }[] = [];

  for (const batch of data.batches) {
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

      const arrivedOn = batch.arrivalDate?.slice(0, 10);
      if (arrivedOn) {
        arrivalEvents.push({ date: arrivedOn, value: batchLandedTotal(data, batch) });
      }
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

  return {
    kpis: {
      stockValue,
      capitalTied,
      avgLandedPerUnit: qtyWeighted > 0 ? landedWeighted / qtyWeighted : 0,
      openReceipts,
      overdueReceipts,
    },
    productBars,
    pipelineMix,
    fidelity: fidelity.slice(0, 12),
    stockTrend,
  };
}
