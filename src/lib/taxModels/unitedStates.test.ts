import { describe, expect, it } from "vitest";
import {
  computeUsTaxBreakdown,
  getUsStateTaxRate,
  isUsStateWithoutClassicCit,
  listUsStateTaxRates,
} from "@/lib/taxModels";

describe("US state tax reference", () => {
  it("lists 50 states + DC", () => {
    expect(listUsStateTaxRates()).toHaveLength(51);
  });

  it("marks NV/OH/SD/TX/WA/WY as without classic CIT", () => {
    for (const code of ["NV", "OH", "SD", "TX", "WA", "WY"]) {
      expect(isUsStateWithoutClassicCit(getUsStateTaxRate(code))).toBe(true);
    }
    expect(isUsStateWithoutClassicCit(getUsStateTaxRate("CA"))).toBe(false);
  });
});

describe("TaxModelUnitedStates", () => {
  it("applies federal + state×(1−federal) for California", () => {
    const r = computeUsTaxBreakdown({
      usFederalIncomeTaxPercent: 21,
      usStateCode: "CA",
      usStateTaxPercent: 8.84,
      usLocalTaxPercent: 0,
    });
    expect(r.alternativeTaxOnly).toBe(false);
    expect(r.federalPercent).toBe(21);
    expect(r.stateAfterFederalDeductionPercent).toBeCloseTo(8.84 * 0.79, 6);
    expect(r.nominalCombinedPercent).toBeCloseTo(21 + 8.84 * 0.79, 6);
  });

  it("includes local tax after federal deduction", () => {
    const r = computeUsTaxBreakdown({
      usFederalIncomeTaxPercent: 21,
      usStateCode: "NY",
      usStateTaxPercent: 7.25,
      usLocalTaxPercent: 4,
    });
    expect(r.localAfterFederalDeductionPercent).toBeCloseTo(4 * 0.79, 6);
    expect(r.nominalCombinedPercent).toBeCloseTo(
      21 + 7.25 * 0.79 + 4 * 0.79,
      6,
    );
  });

  it("zeros state CIT for Texas and flags alternative tax", () => {
    const r = computeUsTaxBreakdown({
      usFederalIncomeTaxPercent: 21,
      usStateCode: "TX",
      usStateTaxPercent: 5,
      usLocalTaxPercent: 0,
    });
    expect(r.alternativeTaxOnly).toBe(true);
    expect(r.statePercent).toBe(0);
    expect(r.stateAfterFederalDeductionPercent).toBe(0);
    expect(r.nominalCombinedPercent).toBe(21);
  });
});
