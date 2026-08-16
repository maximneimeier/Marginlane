import type {
  Batch,
  BatchDuty,
  BatchQuote,
  CatalogProduct,
  Component,
  CostItem,
  PaymentUnit,
} from "./types";
import { emptyBatchDuty } from "./types";
import { createId } from "./format";

export type DutySource = "batch" | "product" | "component" | "none";

function dutyMeaningful(duty: BatchDuty): boolean {
  return Boolean(
    duty.hsCode.trim() ||
      duty.countryOfOrigin.trim() ||
      duty.ratePercent > 0 ||
      duty.fixedAmount > 0,
  );
}

/**
 * Duty: Charge-Override > Produkt-Stamm > erste Komponente mit HS/Satz.
 * Leere Charge-Duty = erben.
 */
export function resolveDuty(
  batch: Batch,
  product: CatalogProduct | undefined,
  components: Component[],
): { duty: BatchDuty; source: DutySource } {
  const batchDuty = normalizeDuty(batch.duty);
  if (dutyMeaningful(batchDuty)) {
    return { duty: batchDuty, source: "batch" };
  }

  if (product) {
    const fromProduct: BatchDuty = {
      hsCode: product.hsCode ?? "",
      countryOfOrigin: product.countryOfOrigin ?? "",
      ratePercent: product.dutyRatePercent ?? 0,
      fixedAmount: 0,
    };
    if (dutyMeaningful(fromProduct)) {
      return { duty: fromProduct, source: "product" };
    }
  }

  for (const c of components) {
    const fromComp: BatchDuty = {
      hsCode: c.hsCode ?? "",
      countryOfOrigin: c.countryOfOrigin ?? "",
      ratePercent: c.dutyRatePercent ?? 0,
      fixedAmount: 0,
    };
    if (dutyMeaningful(fromComp)) {
      return { duty: fromComp, source: "component" };
    }
  }

  return { duty: emptyBatchDuty(), source: "none" };
}

export function dutyToCostItems(duty: BatchDuty | null | undefined): CostItem[] {
  if (!duty) return [];
  const items: CostItem[] = [];
  if (duty.ratePercent > 0) {
    items.push({
      id: createId("duty"),
      type: "Zoll",
      label: duty.hsCode
        ? `Zoll ${duty.ratePercent}% (HS ${duty.hsCode})`
        : `Zoll ${duty.ratePercent}%`,
      amount: duty.ratePercent,
      allocation: "percent_of_goods",
      phase: "transport",
    });
  }
  if (duty.fixedAmount > 0) {
    items.push({
      id: createId("duty"),
      type: "Zoll",
      label: duty.hsCode
        ? `Zoll pauschal (HS ${duty.hsCode})`
        : "Zoll pauschal",
      amount: duty.fixedAmount,
      allocation: "lump_sum",
      phase: "transport",
    });
  }
  return items;
}

export function normalizeDuty(raw: unknown): BatchDuty {
  if (!raw || typeof raw !== "object") return emptyBatchDuty();
  const d = raw as Partial<BatchDuty>;
  return {
    hsCode: typeof d.hsCode === "string" ? d.hsCode : "",
    countryOfOrigin:
      typeof d.countryOfOrigin === "string" ? d.countryOfOrigin : "",
    ratePercent:
      typeof d.ratePercent === "number" && Number.isFinite(d.ratePercent)
        ? Math.max(d.ratePercent, 0)
        : 0,
    fixedAmount:
      typeof d.fixedAmount === "number" && Number.isFinite(d.fixedAmount)
        ? Math.max(d.fixedAmount, 0)
        : 0,
  };
}

export function normalizeQuote(raw: unknown): BatchQuote | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Partial<BatchQuote>;
  return {
    id: typeof q.id === "string" ? q.id : createId("quote"),
    label: typeof q.label === "string" ? q.label : "Quote",
    supplierId: typeof q.supplierId === "string" ? q.supplierId : "",
    unitPurchasePrice:
      typeof q.unitPurchasePrice === "number" ? q.unitPurchasePrice : null,
    currency: typeof q.currency === "string" ? q.currency : null,
    paymentDays: typeof q.paymentDays === "number" ? q.paymentDays : null,
    paymentUnit: (q.paymentUnit as PaymentUnit | null) ?? null,
    skontoPercent: typeof q.skontoPercent === "number" ? q.skontoPercent : null,
    skontoDays: typeof q.skontoDays === "number" ? q.skontoDays : null,
    incoterm: typeof q.incoterm === "string" ? q.incoterm : null,
    costItems: Array.isArray(q.costItems) ? q.costItems : [],
    applySkonto: typeof q.applySkonto === "boolean" ? q.applySkonto : null,
    fxRateOverride:
      typeof q.fxRateOverride === "number" && q.fxRateOverride > 0
        ? q.fxRateOverride
        : null,
    duty: normalizeDuty(q.duty),
  };
}

/** Overlay aktive Quote auf Batch für Economics */
export function batchWithActiveQuote(batch: Batch): Batch {
  const quote = batch.quotes?.find((q) => q.id === batch.activeQuoteId);
  if (!quote) return batch;
  return {
    ...batch,
    supplierId: quote.supplierId || batch.supplierId,
    unitPurchasePrice: quote.unitPurchasePrice,
    currency: quote.currency,
    paymentDays: quote.paymentDays,
    paymentUnit: quote.paymentUnit,
    skontoPercent: quote.skontoPercent,
    skontoDays: quote.skontoDays,
    incoterm: quote.incoterm,
    costItems: quote.costItems,
    applySkonto: quote.applySkonto,
    fxRateOverride: quote.fxRateOverride,
    duty: quote.duty,
  };
}

export function quoteFromBatch(batch: Batch, label: string): BatchQuote {
  return {
    id: createId("quote"),
    label,
    supplierId: batch.supplierId,
    unitPurchasePrice: batch.unitPurchasePrice,
    currency: batch.currency,
    paymentDays: batch.paymentDays,
    paymentUnit: batch.paymentUnit,
    skontoPercent: batch.skontoPercent,
    skontoDays: batch.skontoDays,
    incoterm: batch.incoterm,
    costItems: structuredClone(batch.costItems),
    applySkonto: batch.applySkonto,
    fxRateOverride: batch.fxRateOverride,
    duty: structuredClone(batch.duty ?? emptyBatchDuty()),
  };
}
