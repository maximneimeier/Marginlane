import { describe, expect, it } from "vitest";
import {
  getBatchPipelineStatus,
  countBatchesByPipelineStatus,
  filterBatchesByPipeline,
} from "./batchPipeline";
import type { Batch } from "./types";

function batch(partial: Partial<Batch> & Pick<Batch, "id">): Batch {
  return {
    productId: "p1",
    supplierId: "s1",
    label: "PO",
    quantity: 10,
    unitPurchasePrice: 1,
    currency: null,
    paymentDays: null,
    paymentUnit: null,
    skontoPercent: null,
    skontoDays: null,
    incoterm: null,
    costItems: [],
    sales: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    orderDate: "2026-01-01",
    arrivalDate: null,
    soldDate: null,
    applySkonto: null,
    fxRateOverride: null,
    duty: {
      hsCode: "",
      countryOfOrigin: "",
      ratePercent: 0,
      fixedAmount: 0,
    },
    quotes: [],
    activeQuoteId: null,
    ...partial,
  };
}

describe("batchPipeline", () => {
  const today = "2026-08-20";

  it("classifies ordered / in_transit / arrived", () => {
    expect(getBatchPipelineStatus(batch({ id: "1", arrivalDate: null }), today)).toBe(
      "ordered",
    );
    expect(
      getBatchPipelineStatus(batch({ id: "2", arrivalDate: "2026-08-25" }), today),
    ).toBe("in_transit");
    expect(
      getBatchPipelineStatus(batch({ id: "3", arrivalDate: "2026-08-10" }), today),
    ).toBe("arrived");
  });

  it("counts and filters", () => {
    const batches = [
      batch({ id: "a", arrivalDate: null }),
      batch({ id: "b", arrivalDate: "2026-09-01" }),
      batch({ id: "c", arrivalDate: "2026-08-01" }),
    ];
    expect(countBatchesByPipelineStatus(batches, today)).toEqual({
      ordered: 1,
      in_transit: 1,
      arrived: 1,
    });
    expect(filterBatchesByPipeline(batches, "ordered", today)).toHaveLength(1);
  });
});
