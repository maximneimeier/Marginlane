import type { CompanySettings } from "@/lib/types";
import type { TaxComputationResult, TaxModel } from "./types";

export const TaxModelOther: TaxModel = {
  id: "other",
  compute(settings: CompanySettings): TaxComputationResult {
    const rate = Math.max(0, settings.corporateTaxPercent || 0);
    return {
      regime: "other",
      nominalCombinedPercent: rate,
      effectiveCombinedPercent: rate,
      capitalTaxPermille: null,
    };
  },
};
