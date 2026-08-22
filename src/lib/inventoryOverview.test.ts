import { describe, expect, it } from "vitest";
import {
  buildInventoryOverview,
  buildInventoryStockTrend,
} from "./inventoryOverview";
import type { AppData, Batch, Component } from "./types";
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

function component(
  partial: Partial<Component> & Pick<Component, "id" | "name">,
): Component {
  return {
    supplierId: "s1",
    sku: "",
    currency: "EUR",
    purchasePricePerUnit: 1,
    moq: 0,
    discountTiers: [],
    priceHistory: [],
    hsCode: "",
    countryOfOrigin: "",
    dutyRatePercent: 0,
    notes: "",
    stockProductId: null,
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
    expect(overview.componentBars).toEqual([]);
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

  it("builds component stock bars for linked parts", () => {
    const data: AppData = {
      ...EMPTY_DATA,
      catalogProducts: [
        {
          id: "sp1",
          name: "Gehäuse",
          sku: "GH",
          pricingUnit: "pcs",
          listPrice: null,
          currency: "EUR",
          status: "active",
          category: "",
          targetMarginPercent: null,
          notes: "",
          createdAt: "2026-01-01T00:00:00.000Z",
          hsCode: "",
          countryOfOrigin: "",
          dutyRatePercent: 0,
          documents: [],
        },
      ],
      components: [
        component({
          id: "c1",
          name: "Gehäuse",
          sku: "GH",
          purchasePricePerUnit: 4,
          stockProductId: "sp1",
        }),
      ],
      batches: [
        batch({
          id: "part",
          productId: "sp1",
          quantity: 12,
          unitPurchasePrice: 4,
          arrivalDate: "2026-08-01",
          receivedQuantity: 12,
        }),
      ],
    };
    const overview = buildInventoryOverview(data, today, "parts");
    expect(overview.componentBars).toHaveLength(1);
    expect(overview.componentBars[0].onHand).toBe(12);
    expect(overview.componentBars[0].stockValue).toBe(48);
  });

  it("filters stock trend by component parts only", () => {
    const data: AppData = {
      ...EMPTY_DATA,
      catalogProducts: [
        {
          id: "finished",
          name: "Fertigset",
          sku: "FIN",
          pricingUnit: "pcs",
          listPrice: null,
          currency: "EUR",
          status: "active",
          category: "",
          targetMarginPercent: null,
          notes: "",
          createdAt: "2026-01-01T00:00:00.000Z",
          hsCode: "",
          countryOfOrigin: "",
          dutyRatePercent: 0,
          documents: [],
        },
        {
          id: "sp_led",
          name: "LED Stock",
          sku: "LED",
          pricingUnit: "pcs",
          listPrice: null,
          currency: "EUR",
          status: "active",
          category: "Einzelteil",
          targetMarginPercent: null,
          notes: "",
          createdAt: "2026-01-01T00:00:00.000Z",
          hsCode: "",
          countryOfOrigin: "",
          dutyRatePercent: 0,
          documents: [],
        },
      ],
      components: [
        component({
          id: "cmp_led",
          name: "LED",
          stockProductId: "sp_led",
        }),
      ],
      batches: [
        batch({
          id: "fin",
          productId: "finished",
          quantity: 10,
          unitPurchasePrice: 100,
          arrivalDate: "2026-08-01",
        }),
        batch({
          id: "led1",
          productId: "sp_led",
          quantity: 100,
          unitPurchasePrice: 2,
          arrivalDate: "2026-07-01",
        }),
        batch({
          id: "led2",
          productId: "sp_led",
          quantity: 50,
          unitPurchasePrice: 2,
          arrivalDate: "2026-08-05",
        }),
      ],
    };
    const allParts = buildInventoryStockTrend(data, null, today);
    const onlyLed = buildInventoryStockTrend(data, "cmp_led", today);
    // finished goods excluded → 200 + 100 = 300
    expect(allParts[allParts.length - 1]?.value).toBe(300);
    expect(onlyLed.length).toBeGreaterThanOrEqual(2);
    expect(onlyLed[onlyLed.length - 1]?.value).toBe(300);
    expect(buildInventoryOverview(data, today, "parts").stockTrendComponents).toEqual([
      {
        componentId: "cmp_led",
        name: "LED",
        stockProductId: "sp_led",
      },
    ]);
  });
});
