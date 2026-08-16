import { describe, expect, it } from "vitest";
import { calculateUnitEconomics } from "./calc";
import {
  convertToBase,
  defaultFxRatesForBase,
  fxRateToBase,
  parseFxRatesCsv,
  ratesAsOf,
} from "./fx";
import type { CompanySettings } from "./types";
import { EMPTY_COMPANY_SETTINGS } from "./types";

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

  it("picks historical rates by order date", () => {
    const settings: CompanySettings = {
      ...EMPTY_COMPANY_SETTINGS,
      baseCurrency: "EUR",
      fxRates: { ...defaultFxRatesForBase("EUR"), USD: 0.9 },
      fxRateHistory: [
        {
          id: "1",
          date: "2026-06-01",
          rates: { ...defaultFxRatesForBase("EUR"), USD: 0.85 },
          note: "",
        },
        {
          id: "2",
          date: "2026-01-01",
          rates: { ...defaultFxRatesForBase("EUR"), USD: 0.95 },
          note: "",
        },
      ],
    };
    expect(ratesAsOf(settings, "2026-03-15").USD).toBeCloseTo(0.95);
    expect(ratesAsOf(settings, "2026-07-01").USD).toBeCloseTo(0.85);
    expect(ratesAsOf(settings, "2025-01-01").USD).toBeCloseTo(0.9);
  });

  it("parses fx csv", () => {
    const csv = "date,USD,CNY\n2026-02-01,0.91,0.12\n";
    const rows = parseFxRatesCsv(csv, "EUR");
    expect(rows).toHaveLength(1);
    expect(rows[0].rates.USD).toBeCloseTo(0.91);
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
    expect(withSkonto.landedCostPerUnit).toBeLessThan(
      without.landedCostPerUnit,
    );
    expect(withSkonto.contributionPerUnit).toBeGreaterThan(
      without.contributionPerUnit,
    );
  });
});
