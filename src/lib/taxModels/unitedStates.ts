import type { CompanySettings, UsTaxJurisdiction } from "@/lib/types";
import type { TaxComputationResult, TaxModel } from "./types";

/** Federal + gewichtete State-Sätze (ohne Franchise). */
export function usCombinedIncomeTaxPercent(settings: {
  usFederalIncomeTaxPercent: number;
  usTaxJurisdictions: UsTaxJurisdiction[];
}): number {
  const federal = Math.max(0, settings.usFederalIncomeTaxPercent || 0);
  let state = 0;
  for (const j of settings.usTaxJurisdictions ?? []) {
    const rate = Math.max(0, j.incomeTaxPercent || 0);
    const ap = Math.max(0, j.apportionmentPercent || 0) / 100;
    state += rate * ap;
  }
  return federal + state;
}

export const TaxModelUnitedStates: TaxModel = {
  id: "us",
  compute(settings: CompanySettings): TaxComputationResult {
    const rate = usCombinedIncomeTaxPercent(settings);
    return {
      regime: "us",
      nominalCombinedPercent: rate,
      effectiveCombinedPercent: rate,
      capitalTaxPermille: null,
    };
  },
};
