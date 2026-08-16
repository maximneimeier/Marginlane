import type { AppData, Batch } from "./types";
import type { WaterfallStep } from "./calc";
import {
  buildBatchContributionSlice,
  defaultOverviewRange,
  inRange,
  type BatchContributionSlice,
  type DateRange,
} from "./overview";
import { batchTimeline } from "./resolve";
import { buildOverheadReport } from "./overhead";

export type { BatchContributionSlice };

export function getBatchContribution(
  data: AppData,
  batch: Batch,
): BatchContributionSlice {
  return buildBatchContributionSlice(data, batch);
}

/** Gemeinkosten-Anteil der Charge am Produkt (Perioden-Umlage). */
export function batchOverheadShare(
  data: AppData,
  batch: Batch,
  range: DateRange = defaultOverviewRange(),
): number {
  const report = buildOverheadReport(data, range);
  const row = report.byProduct.find((p) => p.productId === batch.productId);
  if (!row || row.overhead === 0) return 0;

  let productQty = 0;
  for (const b of data.batches) {
    if (b.productId !== batch.productId) continue;
    const sold = batchTimeline(b).soldDate;
    if (!inRange(sold, range)) continue;
    productQty += Math.max(b.quantity, 0);
  }
  if (productQty <= 0) return 0;
  return row.overhead * (Math.max(batch.quantity, 0) / productQty);
}

/**
 * DB1→DB3(+optional Gemeinkosten)-Wasserfall pro Einheit,
 * gleiche Buckets wie Overview.
 */
export function buildBatchContributionWaterfall(
  slice: BatchContributionSlice,
  quantity: number,
  overheadTotal = 0,
): WaterfallStep[] {
  const qty = Math.max(quantity, 0);
  const per = (n: number) => (qty > 0 ? n / qty : 0);

  const steps: WaterfallStep[] = [
    {
      id: "wf_revenue",
      label: "Revenue",
      amountPerUnit: per(slice.revenue),
      runningTotal: per(slice.revenue),
      kind: "revenue",
    },
    {
      id: "wf_material",
      label: "− Material",
      amountPerUnit: per(slice.material),
      runningTotal: per(slice.db1),
      kind: "cost",
    },
    {
      id: "wf_db1",
      label: "DB1",
      amountPerUnit: per(slice.db1),
      runningTotal: per(slice.db1),
      kind: "subtotal",
    },
    {
      id: "wf_logistics",
      label: "− Logistics",
      amountPerUnit: per(slice.logistics),
      runningTotal: per(slice.db2),
      kind: "cost",
    },
    {
      id: "wf_db2",
      label: "DB2",
      amountPerUnit: per(slice.db2),
      runningTotal: per(slice.db2),
      kind: "subtotal",
    },
  ];

  if (slice.marketing > 0) {
    steps.push({
      id: "wf_marketing",
      label: "− Marketing",
      amountPerUnit: per(slice.marketing),
      runningTotal: per(slice.db2 - slice.marketing),
      kind: "cost",
    });
  }
  if (slice.sales > 0) {
    steps.push({
      id: "wf_sales",
      label: "− Sales",
      amountPerUnit: per(slice.sales),
      runningTotal: per(slice.db3),
      kind: "cost",
    });
  }

  steps.push({
    id: "wf_db3",
    label: "DB3",
    amountPerUnit: per(slice.db3),
    runningTotal: per(slice.db3),
    kind: "margin",
  });

  if (overheadTotal > 0) {
    const after = slice.db3 - overheadTotal;
    steps.push({
      id: "wf_overhead",
      label: "− Gemeinkosten",
      amountPerUnit: per(overheadTotal),
      runningTotal: per(after),
      kind: "cost",
    });
    steps.push({
      id: "wf_result",
      label: "Betriebsergebnis",
      amountPerUnit: per(after),
      runningTotal: per(after),
      kind: "margin",
    });
  }

  return steps;
}
