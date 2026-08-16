import { describe, expect, it } from "vitest";
import { calculateUnitEconomics } from "./calc";
import { convertToBase, defaultFxRatesForBase, fxRateToBase } from "./fx";

describe("fx", () => {
  it("keeps base currency at rate 1", () => {
    expect(fxRateToBase("EUR", "EUR", undefined, null)).toBe(1);
  });

  it("converts USD to EUR via defaults", () => {
    const rates = defaultFxRatesForBase("EUR");
    expect(convertToBase(100, "USD", "EUR", rates)).toBeCloseTo(92, 5);
  });

  it("honors batch override", () => {
    expect(convertToBase(10, "USD", "EUR", {}, 0.5)).toBe(5);
  });
});

describe("skonto in unit economics", () => {
  it("reduces purchase and landed cost", () => {
    const without = calculateUnitEconomics({
      quantity: 100,
      unitPurchasePrice: 10,
      procurementItems: [],
      sellPrice: 20,
      salesItems: [],
    });
    const withSkonto = calculateUnitEconomics({
      quantity: 100,
      unitPurchasePrice: 10,
      procurementItems: [],
      sellPrice: 20,
      salesItems: [],
      skontoPercent: 2,
    });
    expect(withSkonto.purchasePerUnit).toBeCloseTo(9.8);
    expect(withSkonto.skontoPerUnit).toBeCloseTo(0.2);
    expect(withSkonto.landedCostPerUnit).toBeLessThan(without.landedCostPerUnit);
    expect(withSkonto.contributionPerUnit).toBeGreaterThan(
      without.contributionPerUnit,
    );
  });
});
