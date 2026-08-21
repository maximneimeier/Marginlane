import { describe, expect, it } from "vitest";
import { buildInventoryOverview } from "./inventoryOverview";
import type { AppData, Batch } from "./types";
import { EMPTY_DATA, emptyBatchDuty } from "./types";

function batch(partial: Partial<Batch> & Pick<Batch, "id">): Batch {
  return {
    productId: "p1",
    supplierId: "s1",
    label: "PO",
    quantity: 10,
    unitPurchasePrice: 5,
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
    expectedArrivalDate: null,
    arrivalDate: null,
    soldDate: null,
    poNumber: "",
    notes: "",
    receivedQuantity: null,
    applySkonto: null,
    fxRateOverride: null,
    duty: emptyBatchDuty(),
    quotes: [],
    activeQuoteId: null,
    ...partial,
  };
}

describe("buildInventoryOverview", () => {
  const today = "2026-08-20";

  it("splits capital and stock value by pipeline status", () => {
    const data: AppData = {
      ...EMPTY_DATA,
      batches: [
        batch({
          id: "a",
          label: "Ordered",
          quantity: 10,
          unitPurchasePrice: 10,
          arrivalDate: null,
        }),
        batch({
          id: "b",
          label: "Arrived",
          quantity: 4,
          unitPurchasePrice: 20,
          arrivalDate: "2026-08-01",
          expectedArrivalDate: "2026-08-01",
        }),
      ],
    };

    const overview = buildInventoryOverview(data, today);
    expect(overview.kpis.capitalTied).toBe(100);
    expect(overview.kpis.stockValue).toBe(80);
    expect(overview.kpis.openReceipts).toBe(1);
    expect(overview.pipelineMix.ordered).toBe(100);
    expect(overview.pipelineMix.arrived).toBe(80);
  });

  it("flags overdue ETA without arrival", () => {
    const data: AppData = {
      ...EMPTY_DATA,
      batches: [
        batch({
          id: "late",
          expectedArrivalDate: "2026-08-01",
          arrivalDate: null,
        }),
      ],
    };
    const overview = buildInventoryOverview(data, today);
    expect(overview.kpis.overdueReceipts).toBe(1);
    expect(overview.fidelity[0]?.overdue).toBe(true);
  });
});
