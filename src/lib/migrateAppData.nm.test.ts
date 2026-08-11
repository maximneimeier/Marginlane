import { describe, expect, it } from "vitest";
import {
  catalogProductUnitPurchaseCost,
  migrateAppData,
} from "@/lib/migrateAppData";

describe("migrateAppData component n:m", () => {
  it("splits legacy Component.productId into Component + ProductComponent", () => {
    const migrated = migrateAppData({
      suppliers: [],
      catalogProducts: [
        {
          id: "p1",
          name: "Lamp",
          sku: "L1",
          listPrice: 10,
          pricingUnit: "pcs",
          currency: "EUR",
          status: "active",
          category: "",
          targetMarginPercent: null,
          notes: "",
          createdAt: "2026-01-01",
        },
      ],
      components: [
        {
          id: "c1",
          productId: "p1",
          supplierId: "s1",
          name: "LED",
          sku: "LED-1",
          currency: null,
          purchasePricePerUnit: 2.5,
          quantityPerProductUnit: 3,
          notes: "pack 10",
        },
      ],
      dealers: [],
      batches: [],
      overheadItems: [],
      products: [],
    });

    expect(migrated.components).toHaveLength(1);
    expect(migrated.components[0]).toMatchObject({
      id: "c1",
      name: "LED",
      purchasePricePerUnit: 2.5,
    });
    expect(
      (migrated.components[0] as { productId?: string }).productId,
    ).toBeUndefined();
    expect(migrated.productComponents).toHaveLength(1);
    expect(migrated.productComponents[0]).toMatchObject({
      productId: "p1",
      componentId: "c1",
      quantityPerProductUnit: 3,
      purchasePriceOverride: null,
    });
    expect(
      catalogProductUnitPurchaseCost(
        "p1",
        migrated.components,
        migrated.productComponents,
      ),
    ).toBe(7.5);
  });

  it("does not invent links for already-normalized components", () => {
    const migrated = migrateAppData({
      catalogProducts: [],
      components: [
        {
          id: "c1",
          supplierId: "",
          name: "Alone",
          sku: "",
          currency: "EUR",
          purchasePricePerUnit: 1,
          notes: "",
        },
      ],
      productComponents: [],
      products: [],
      dealers: [],
      batches: [],
      suppliers: [],
    });
    expect(migrated.productComponents).toHaveLength(0);
    expect(migrated.components[0].name).toBe("Alone");
  });
});
