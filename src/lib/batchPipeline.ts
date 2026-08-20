import type { Batch } from "./types";
import { calculateResolvedEconomics } from "./resolve";
import type { AppData } from "./types";

export type BatchPipelineStatus = "ordered" | "in_transit" | "arrived";

export type BatchPipelineFilter = BatchPipelineStatus | "all";

/** Heute als YYYY-MM-DD (lokal). */
export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * PO-Pipeline-Status aus Rohdaten (ohne Timeline-Fallbacks).
 * — bestellt: noch kein Ankunftsdatum
 * — unterwegs: Ankunft in der Zukunft
 * — angekommen: Ankunft heute oder früher
 */
export function getBatchPipelineStatus(
  batch: Batch,
  today: string = todayIsoDate(),
): BatchPipelineStatus {
  const arrival = batch.arrivalDate?.slice(0, 10) || null;
  if (!arrival) return "ordered";
  if (arrival > today) return "in_transit";
  return "arrived";
}

export function countBatchesByPipelineStatus(
  batches: Batch[],
  today: string = todayIsoDate(),
): Record<BatchPipelineStatus, number> {
  const counts: Record<BatchPipelineStatus, number> = {
    ordered: 0,
    in_transit: 0,
    arrived: 0,
  };
  for (const batch of batches) {
    counts[getBatchPipelineStatus(batch, today)] += 1;
  }
  return counts;
}

export function filterBatchesByPipeline(
  batches: Batch[],
  filter: BatchPipelineFilter,
  today: string = todayIsoDate(),
): Batch[] {
  if (filter === "all") return batches;
  return batches.filter((b) => getBatchPipelineStatus(b, today) === filter);
}

/** Charge für Abverkauf relevant: angekommen oder bereits Verkaufsmengen. */
export function isBatchRelevantForSales(
  data: AppData,
  batch: Batch,
  today: string = todayIsoDate(),
): boolean {
  const status = getBatchPipelineStatus(batch, today);
  if (status === "arrived") return true;
  const econ = calculateResolvedEconomics(data, batch);
  return econ.salesAggregate.soldQuantity > 0;
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
