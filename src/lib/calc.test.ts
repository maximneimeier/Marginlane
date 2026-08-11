import { describe, expect, it } from "vitest";
import {
  calculateUnitEconomics,
  costItemPerUnit,
  costItemTotal,
} from "@/lib/calc";
import type { CostItem } from "@/lib/types";

function item(
  partial: Partial<CostItem> & Pick<CostItem, "allocation" | "amount">,
): CostItem {
  return {
    id: partial.id ?? "c1",
    type: partial.type ?? "Fracht",
    label: partial.label ?? "Fracht",
    phase: partial.phase ?? "transport",
    allocation: partial.allocation,
    amount: partial.amount,
  };
}

describe("costItemTotal", () => {
  it("per_unit multiplies by quantity", () => {
    expect(costItemTotal(item({ allocation: "per_unit", amount: 2 }), 10, 100)).toBe(
      20,
    );
  });

  it("lump_sum ignores quantity", () => {
    expect(
      costItemTotal(item({ allocation: "lump_sum", amount: 50 }), 10, 100),
    ).toBe(50);
  });

  it("percent_of_goods uses goods value", () => {
    expect(
      costItemTotal(
        item({ allocation: "percent_of_goods", amount: 10 }),
        10,
        200,
      ),
    ).toBe(20);
  });

  it("treats negative quantity as 0 for per_unit", () => {
    expect(
      costItemTotal(item({ allocation: "per_unit", amount: 5 }), -3, 100),
    ).toBe(0);
  });
});

describe("costItemPerUnit", () => {
  it("returns 0 when quantity is 0", () => {
    expect(
      costItemPerUnit(item({ allocation: "lump_sum", amount: 40 }), 0, 100),
    ).toBe(0);
  });

  it("spreads lump_sum across units", () => {
    expect(
      costItemPerUnit(item({ allocation: "lump_sum", amount: 40 }), 8, 100),
    ).toBe(5);
  });
});

describe("calculateUnitEconomics", () => {
  it("builds landed cost and contribution", () => {
    const eco = calculateUnitEconomics({
      quantity: 100,
      unitPurchasePrice: 10,
      procurementItems: [
        item({ id: "f", allocation: "lump_sum", amount: 200 }),
        item({
          id: "z",
          allocation: "percent_of_goods",
          amount: 5,
          type: "Zoll",
          label: "Zoll",
        }),
      ],
      sellPrice: 20,
      salesItems: [
        item({
          id: "p",
          allocation: "percent_of_goods",
          amount: 10,
          type: "Provision",
          label: "Provision",
          phase: "vertrieb",
        }),
      ],
    });

    // goods 1000; freight 2/u; customs 0.5/u → landed 12.5
    expect(eco.landedCostPerUnit).toBe(12.5);
    // sales 10% of revenue 20 → 2; contribution 20 - 12.5 - 2 = 5.5
    expect(eco.salesCostsPerUnit).toBe(2);
    expect(eco.contributionPerUnit).toBe(5.5);
    expect(eco.contributionPercent).toBeCloseTo(27.5);
  });

  it("handles zero units without NaN", () => {
    const eco = calculateUnitEconomics({
      quantity: 0,
      unitPurchasePrice: 10,
      procurementItems: [item({ allocation: "lump_sum", amount: 50 })],
      sellPrice: 20,
      salesItems: [],
    });
    expect(eco.procurementCostsPerUnit).toBe(0);
    expect(eco.landedCostPerUnit).toBe(10);
    expect(Number.isFinite(eco.contributionPerUnit)).toBe(true);
  });

  it("works with empty cost lists", () => {
    const eco = calculateUnitEconomics({
      quantity: 5,
      unitPurchasePrice: 4,
      procurementItems: [],
      sellPrice: 9,
      salesItems: [],
    });
    expect(eco.landedCostPerUnit).toBe(4);
    expect(eco.contributionPerUnit).toBe(5);
  });
});
