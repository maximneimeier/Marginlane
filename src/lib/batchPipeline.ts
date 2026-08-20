import type { AppData, Batch, Sale } from "./types";
import { calculateResolvedEconomics } from "./resolve";
import { emptySale } from "./migrateAppData";
import { createId } from "./format";

export type BatchPipelineStatus =
  | "ordered"
  | "in_transit"
  | "arrived"
  | "sold";

export type BatchPipelineFilter = BatchPipelineStatus | "all";

/** Heute als YYYY-MM-DD (lokal). */
export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function batchSoldQuantity(data: AppData, batch: Batch): number {
  return calculateResolvedEconomics(data, batch).salesAggregate.soldQuantity;
}

export function batchRemainingQuantity(data: AppData, batch: Batch): number {
  return calculateResolvedEconomics(data, batch).remainingQuantity;
}

/**
 * Lebenszyklus der Charge:
 * — bestellt: noch kein Ankunftsdatum
 * — unterwegs: Ankunft in der Zukunft
 * — angekommen: Ankunft ≤ heute und Restbestand > 0
 * — verkauft: Ankunft ≤ heute und Restbestand = 0
 */
export function getBatchPipelineStatus(
  batch: Batch,
  today: string = todayIsoDate(),
  soldQuantity = 0,
): BatchPipelineStatus {
  const arrival = batch.arrivalDate?.slice(0, 10) || null;
  if (!arrival) return "ordered";
  if (arrival > today) return "in_transit";
  if (batch.quantity > 0 && soldQuantity >= batch.quantity) return "sold";
  return "arrived";
}

export function getBatchPipelineStatusForData(
  data: AppData,
  batch: Batch,
  today: string = todayIsoDate(),
): BatchPipelineStatus {
  return getBatchPipelineStatus(batch, today, batchSoldQuantity(data, batch));
}

export function countBatchesByPipelineStatus(
  batches: Batch[],
  data: AppData,
  today: string = todayIsoDate(),
): Record<BatchPipelineStatus, number> {
  const counts: Record<BatchPipelineStatus, number> = {
    ordered: 0,
    in_transit: 0,
    arrived: 0,
    sold: 0,
  };
  for (const batch of batches) {
    counts[getBatchPipelineStatusForData(data, batch, today)] += 1;
  }
  return counts;
}

export function filterBatchesByPipeline(
  batches: Batch[],
  filter: BatchPipelineFilter,
  data: AppData,
  today: string = todayIsoDate(),
): Batch[] {
  if (filter === "all") return batches;
  return batches.filter(
    (b) => getBatchPipelineStatusForData(data, b, today) === filter,
  );
}

/** Charge für Abverkauf relevant: im Lager, verkauft oder schon Verkaufsmengen. */
export function isBatchRelevantForSales(
  data: AppData,
  batch: Batch,
  today: string = todayIsoDate(),
): boolean {
  const status = getBatchPipelineStatusForData(data, batch, today);
  if (status === "arrived" || status === "sold") return true;
  return batchSoldQuantity(data, batch) > 0;
}

/** Im Lager: angekommen und Restbestand. */
export function isBatchInStock(
  data: AppData,
  batch: Batch,
  today: string = todayIsoDate(),
): boolean {
  return getBatchPipelineStatusForData(data, batch, today) === "arrived";
}

export function markBatchArrived(
  batch: Batch,
  today: string = todayIsoDate(),
): Batch {
  return {
    ...batch,
    arrivalDate: today,
  };
}

export function setBatchExpectedArrival(
  batch: Batch,
  arrivalDate: string,
): Batch {
  return {
    ...batch,
    arrivalDate: arrivalDate.slice(0, 10) || null,
  };
}

export type QuickSaleInput = {
  dealerId: string | null;
  quantity: number;
  salePricePerUnit: number | null;
  channel?: string;
};

/**
 * Verkauf nachträglich buchen: Menge auf bestehenden Leer-Sale legen oder neuen Sale anhängen.
 * Bei Restbestand 0 wird soldDate gesetzt.
 */
export function applyQuickSale(
  batch: Batch,
  input: QuickSaleInput,
  today: string = todayIsoDate(),
): Batch {
  const qty = Math.max(0, input.quantity);
  if (qty <= 0) return batch;

  const sales = [...batch.sales];
  const emptySlot = sales.findIndex(
    (s) => s.quantity <= 0 && (s.dealerId == null || s.dealerId === input.dealerId),
  );

  let nextSales: Sale[];
  if (emptySlot >= 0) {
    nextSales = sales.map((s, i) =>
      i === emptySlot
        ? {
            ...s,
            dealerId: input.dealerId,
            quantity: qty,
            salePricePerUnit: input.salePricePerUnit,
            channel: input.channel?.trim() || s.channel,
          }
        : s,
    );
  } else if (sales.length === 1 && sales[0].quantity <= 0) {
    nextSales = [
      {
        ...sales[0],
        dealerId: input.dealerId,
        quantity: qty,
        salePricePerUnit: input.salePricePerUnit,
        channel: input.channel?.trim() || sales[0].channel,
      },
    ];
  } else {
    const base = emptySale(0);
    nextSales = [
      ...sales.filter((s) => s.quantity > 0),
      {
        ...base,
        id: createId("sale"),
        dealerId: input.dealerId,
        quantity: qty,
        salePricePerUnit: input.salePricePerUnit,
        channel: input.channel?.trim() || "",
        costItems: input.dealerId ? null : [],
      },
    ];
  }

  const soldQty = nextSales.reduce((sum, s) => sum + Math.max(0, s.quantity), 0);
  const fullySold = batch.quantity > 0 && soldQty >= batch.quantity;

  return {
    ...batch,
    sales: nextSales,
    soldDate: fullySold ? batch.soldDate || today : batch.soldDate,
  };
}

/** Restmenge als verkauft markieren (auf ersten Sale / neuen Sale). */
export function markBatchSold(
  batch: Batch,
  remainingQuantity: number,
  today: string = todayIsoDate(),
  dealerId: string | null = null,
): Batch {
  if (remainingQuantity <= 0) {
    return {
      ...batch,
      soldDate: batch.soldDate || today,
    };
  }
  return applyQuickSale(
    batch,
    {
      dealerId,
      quantity: remainingQuantity,
      salePricePerUnit: null,
    },
    today,
  );
}
