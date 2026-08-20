import { describe, expect, it } from "vitest";
import {
  getBatchPipelineStatus,
  countBatchesByPipelineStatus,
  filterBatchesByPipeline,
  applyQuickSale,
  markBatchSold,
} from "./batchPipeline";
import type { AppData, Batch } from "./types";
import { EMPTY_DATA } from "./types";

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

  it("classifies ordered / in_transit / arrived / sold", () => {
    expect(getBatchPipelineStatus(batch({ id: "1", arrivalDate: null }), today)).toBe(
      "ordered",
    );
    expect(
      getBatchPipelineStatus(batch({ id: "2", arrivalDate: "2026-08-25" }), today),
    ).toBe("in_transit");
    expect(
      getBatchPipelineStatus(batch({ id: "3", arrivalDate: "2026-08-10" }), today, 0),
    ).toBe("arrived");
    expect(
      getBatchPipelineStatus(batch({ id: "4", arrivalDate: "2026-08-10" }), today, 10),
    ).toBe("sold");
  });

  it("counts and filters with sold qty from data", () => {
    const batches = [
      batch({ id: "a", arrivalDate: null }),
      batch({ id: "b", arrivalDate: "2026-09-01" }),
      batch({
        id: "c",
        arrivalDate: "2026-08-01",
        sales: [
          {
            id: "s1",
            dealerId: null,
            salePricePerUnit: 5,
            quantity: 4,
            channel: "",
            costItems: [],
          },
        ],
      }),
      batch({
        id: "d",
        arrivalDate: "2026-08-01",
        soldDate: "2026-08-10",
        sales: [
          {
            id: "s2",
            dealerId: null,
            salePricePerUnit: 5,
            quantity: 10,
            channel: "",
            costItems: [],
          },
        ],
      }),
    ];
    const data: AppData = { ...EMPTY_DATA, batches };
    expect(countBatchesByPipelineStatus(batches, data, today)).toEqual({
      ordered: 1,
      in_transit: 1,
      arrived: 1,
      sold: 1,
    });
    expect(filterBatchesByPipeline(batches, "sold", data, today)).toHaveLength(1);
  });

  it("applyQuickSale fills remaining and sets soldDate when full", () => {
    const start = batch({
      id: "q",
      quantity: 10,
      arrivalDate: "2026-08-01",
      sales: [
        {
          id: "s0",
          dealerId: null,
          salePricePerUnit: 0,
          quantity: 0,
          channel: "",
          costItems: [],
        },
      ],
    });
    const next = applyQuickSale(
      start,
      { dealerId: "d1", quantity: 10, salePricePerUnit: 12 },
      today,
    );
    expect(next.sales[0].quantity).toBe(10);
    expect(next.sales[0].dealerId).toBe("d1");
    expect(next.soldDate).toBe(today);
  });

  it("markBatchSold books remaining", () => {
    const start = batch({
      id: "m",
      quantity: 10,
      arrivalDate: "2026-08-01",
      sales: [
        {
          id: "s0",
          dealerId: null,
          salePricePerUnit: 8,
          quantity: 3,
          channel: "",
          costItems: [],
        },
      ],
    });
    const next = markBatchSold(start, 7, today, "d2");
    expect(next.sales.reduce((n, s) => n + s.quantity, 0)).toBe(10);
    expect(next.soldDate).toBe(today);
  });
});
