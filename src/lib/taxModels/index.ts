import type { CompanySettings, TaxRegime } from "@/lib/types";
import { TaxModelGermany } from "./germany";
import { TaxModelOther } from "./other";
import { TaxModelSwitzerland } from "./switzerland";
import type { TaxComputationResult, TaxModel } from "./types";
import { TaxModelUnitedStates } from "./unitedStates";

const MODELS: Record<TaxRegime, TaxModel> = {
  de: TaxModelGermany,
  us: TaxModelUnitedStates,
  ch: TaxModelSwitzerland,
  other: TaxModelOther,
};

export function getTaxModel(regime: TaxRegime): TaxModel {
  return MODELS[regime] ?? TaxModelOther;
}

export function computeIncomeTax(
  settings: CompanySettings,
): TaxComputationResult {
  return getTaxModel(settings.taxRegime).compute(settings);
}

export {
  computeGermanTaxBreakdown,
  deCombinedIncomeTaxPercent,
  deEffectiveGewerbesteuerPercent,
  TaxModelGermany,
  type GermanTaxBreakdown,
} from "./germany";
export {
  computeUsTaxBreakdown,
  usCombinedIncomeTaxPercent,
  TaxModelUnitedStates,
  US_FEDERAL_CORPORATE_TAX_PERCENT_DEFAULT,
  type UsTaxBreakdown,
} from "./unitedStates";
export {
  getUsStateTaxRate,
  isUsStateWithoutClassicCit,
  listUsStateTaxRates,
  usStateTaxRatesAsOfYear,
  type UsStateRateType,
  type UsStateTaxRateRow,
} from "./usStateTaxRates";
export { TaxModelOther } from "./other";
export type { TaxComputationResult, TaxPlausibilityResult } from "./types";
export {
  assessSwissTaxPlausibility,
  computeSwissTax,
  computeSwissTaxBreakdown,
  swissEffectiveFromNominalPercent,
  swissTaxInputsFromSettings,
  TaxModelSwitzerland,
  type SwissTaxBreakdown,
  type SwissTaxInputs,
} from "./switzerland";
