import { describe, expect, it } from "vitest";
import {
  checkProductionStock,
  completeProductionRun,
  estimateProductionRun,
  manufacturingCostItemsFromRouting,
  productionInputsFromBom,
} from "./production";
import type { AppData, Batch, Component, ProductComponent } from "./types";
import { EMPTY_DATA, emptyBatchDuty } from "./types";

function component(
  partial: Partial<Component> & Pick<Component, "id">,
): Component {
  return {
    supplierId: "s1",
    name: "Part",
    sku: "",
    currency: "EUR",
    purchasePricePerUnit: 2,
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

function stockBatch(
  partial: Partial<Batch> & Pick<Batch, "id" | "productId" | "quantity">,
): Batch {
  return {
    supplierId: "s1",
    label: "Stock",
    unitPurchasePrice: 4,
    currency: "EUR",
    paymentDays: null,
    paymentUnit: null,
    skontoPercent: null,
    skontoDays: null,
    incoterm: null,
    costItems: [],
    sales: [],
    consumptions: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    orderDate: "2026-01-01",
    expectedArrivalDate: "2026-01-01",
    arrivalDate: "2026-01-01",
    soldDate: null,
    poNumber: "",
    notes: "",
    receivedQuantity: partial.quantity,
    applySkonto: false,
    fxRateOverride: null,
    duty: emptyBatchDuty(),
    quotes: [],
    activeQuoteId: null,
    ...partial,
  };
}

describe("production run costing", () => {
  const components: Component[] = [
    component({ id: "c1", name: "Gehäuse", purchasePricePerUnit: 4 }),
    component({ id: "c2", name: "PCB", purchasePricePerUnit: 6 }),
  ];
  const productComponents: ProductComponent[] = [
    {
      id: "pc1",
      productId: "p1",
      componentId: "c1",
      quantityPerProductUnit: 1,
      scrapRate: 0,
      purchasePriceOverride: null,
    },
    {
      id: "pc2",
      productId: "p1",
      componentId: "c2",
      quantityPerProductUnit: 2,
      scrapRate: 0,
      purchasePriceOverride: null,
    },
  ];

  const data: AppData = {
    ...EMPTY_DATA,
    components,
    productComponents,
    catalogProducts: [
      {
        id: "p1",
        name: "Device",
        sku: "DEV",
        pricingUnit: "pcs",
        listPrice: 50,
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
  };

  it("builds inputs from BOM including position scrap", () => {
    const withScrap: AppData = {
      ...data,
      productComponents: [
        {
          id: "pc1",
          productId: "p1",
          componentId: "c1",
          quantityPerProductUnit: 1,
          scrapRate: 0.1,
          purchasePriceOverride: null,
        },
        {
          id: "pc2",
          productId: "p1",
          componentId: "c2",
          quantityPerProductUnit: 2,
          scrapRate: 0,
          purchasePriceOverride: null,
        },
      ],
    };
    const inputs = productionInputsFromBom(withScrap, "p1");
    expect(inputs).toHaveLength(2);
    expect(inputs.map((i) => i.quantityPerOutput)).toEqual([1.1, 2]);
  });

  it("maps routing steps to amortized manufacturing cost items", () => {
    const items = manufacturingCostItemsFromRouting(
      [
        {
          id: "r1",
          name: "Montage",
          sortOrder: 0,
          setupMinutes: 60,
          runMinutesPerUnit: 6,
          hourlyRate: 30,
          rateType: "labor",
        },
      ],
      10,
    );
    // setup 30€ / 10 + run 3€ = 6€/unit
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(6);
    expect(items[0].allocation).toBe("per_unit");
  });

  it("estimates material + manufacturing per unit", () => {
    const inputs = productionInputsFromBom(data, "p1");
    const estimate = estimateProductionRun(data, {
      outputProductId: "p1",
      outputQuantity: 10,
      scrapRate: 0,
      inputs,
      costItems: [
        {
          id: "m1",
          type: "Montage / Repacking",
          label: "Montage",
          amount: 50,
          allocation: "lump_sum",
          phase: "einkauf",
        },
      ],
    });
    expect(estimate.materialTotal).toBe(160);
    expect(estimate.manufacturingTotal).toBe(50);
    expect(estimate.unitCost).toBe(21);
    expect(estimate.materialPerUnit).toBe(16);
  });

  it("increases material demand with scrap", () => {
    const inputs = productionInputsFromBom(data, "p1");
    const estimate = estimateProductionRun(data, {
      outputProductId: "p1",
      outputQuantity: 10,
      scrapRate: 0.2,
      inputs,
      costItems: [],
    });
    expect(estimate.materialTotal).toBe(200);
    expect(estimate.outputQuantity).toBe(10);
  });

  it("completes untracked into an arrived batch", () => {
    const inputs = productionInputsFromBom(data, "p1");
    const result = completeProductionRun(data, {
      id: "prun1",
      label: "Lauf A",
      outputProductId: "p1",
      outputQuantity: 10,
      scrapRate: 0,
      inputs,
      costItems: [
        {
          id: "m1",
          type: "Montage / Repacking",
          label: "Montage",
          amount: 50,
          allocation: "lump_sum",
          phase: "einkauf",
        },
      ],
      status: "planned",
      notes: "",
      createdAt: "2026-08-01T00:00:00.000Z",
      completedAt: null,
      outputBatchId: null,
      consumptions: [],
    });
    expect(result).not.toBeNull();
    expect(result!.run.status).toBe("done");
    expect(result!.batch.quantity).toBe(10);
    expect(result!.batch.unitPurchasePrice).toBe(16);
    expect(result!.updatedBatches).toHaveLength(0);
  });
});

describe("production stock stage 2", () => {
  const components: Component[] = [
    component({
      id: "c1",
      name: "Gehäuse",
      purchasePricePerUnit: 4,
      stockProductId: "sp1",
    }),
  ];
  const productComponents: ProductComponent[] = [
    {
      id: "pc1",
      productId: "p1",
      componentId: "c1",
      quantityPerProductUnit: 1,
      purchasePriceOverride: null,
    },
  ];

  const base: AppData = {
    ...EMPTY_DATA,
    components,
    productComponents,
    catalogProducts: [
      {
        id: "p1",
        name: "Device",
        sku: "DEV",
        pricingUnit: "pcs",
        listPrice: 50,
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
        id: "sp1",
        name: "Gehäuse Stock",
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
    batches: [
      stockBatch({ id: "b1", productId: "sp1", quantity: 5, unitPurchasePrice: 4 }),
      stockBatch({
        id: "b2",
        productId: "sp1",
        quantity: 10,
        unitPurchasePrice: 5,
        arrivalDate: "2026-02-01",
      }),
    ],
  };

  it("detects shortfall against on-hand", () => {
    const run = {
      id: "prun",
      label: "",
      outputProductId: "p1",
      outputQuantity: 20,
      scrapRate: 0,
      inputs: productionInputsFromBom(base, "p1"),
      costItems: [],
      status: "planned" as const,
      notes: "",
      createdAt: "2026-08-01T00:00:00.000Z",
      completedAt: null,
      outputBatchId: null,
      consumptions: [],
    };
    const check = checkProductionStock(base, run);
    expect(check.hasShortfall).toBe(true);
    expect(check.lines[0].onHand).toBe(15);
    expect(check.lines[0].needed).toBe(20);
    expect(completeProductionRun(base, run)).toBeNull();
  });

  it("debits FIFO batches on complete", () => {
    const run = {
      id: "prun",
      label: "Montage",
      outputProductId: "p1",
      outputQuantity: 8,
      scrapRate: 0,
      inputs: productionInputsFromBom(base, "p1"),
      costItems: [],
      status: "planned" as const,
      notes: "",
      createdAt: "2026-08-01T00:00:00.000Z",
      completedAt: null,
      outputBatchId: null,
      consumptions: [],
    };
    const result = completeProductionRun(base, run);
    expect(result).not.toBeNull();
    expect(result!.run.consumptions).toHaveLength(2);
    // FIFO: 5 from b1 + 3 from b2
    expect(
      result!.run.consumptions.map((c) => [c.batchId, c.quantity]),
    ).toEqual([
      ["b1", 5],
      ["b2", 3],
    ]);
    const b1 = result!.updatedBatches.find((b) => b.id === "b1");
    const b2 = result!.updatedBatches.find((b) => b.id === "b2");
    expect(b1?.consumptions?.[0]?.quantity).toBe(5);
    expect(b2?.consumptions?.[0]?.quantity).toBe(3);
    // material: 5*4 + 3*5 = 35 → per unit 35/8
    expect(result!.batch.unitPurchasePrice).toBeCloseTo(35 / 8, 6);
  });
});
