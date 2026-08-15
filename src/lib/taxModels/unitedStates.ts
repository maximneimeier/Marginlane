import type { CompanySettings } from "@/lib/types";
import type { TaxComputationResult, TaxModel } from "./types";
import {
  getUsStateTaxRate,
  isUsStateWithoutClassicCit,
  type UsStateTaxRateRow,
} from "./usStateTaxRates";

export const US_FEDERAL_CORPORATE_TAX_PERCENT_DEFAULT = 21;

export type UsTaxBreakdown = TaxComputationResult & {
  regime: "us";
  federalPercent: number;
  stateCode: string;
  stateName: string;
  stateRateType: UsStateTaxRateRow["rate_type"] | "";
  statePercent: number;
  localPercent: number;
  /** state × (1 − federal/100) */
  stateAfterFederalDeductionPercent: number;
  /** local × (1 − federal/100) */
  localAfterFederalDeductionPercent: number;
  /** true wenn keine %-basierte State-CIT (none / alternative_tax) */
  alternativeTaxOnly: boolean;
  graduated: boolean;
  rateRange: string | null;
};

function nonNeg(n: number): number {
  return Math.max(0, Number.isFinite(n) ? n : 0);
}

/**
 * US-Gesamtsteuersatz (Planung):
 * Bund + (State + Local) × (1 − Bund/100)
 * State-Steuer ist von der Bundesbemessungsgrundlage abzugsfähig.
 *
 * Bei States ohne klassische CIT: nur Federal (+ optional Local mit Abzug).
 */
export function computeUsTaxBreakdown(settings: {
  usFederalIncomeTaxPercent: number;
  usStateCode: string;
  usStateTaxPercent: number;
  usLocalTaxPercent: number;
}): UsTaxBreakdown {
  const federalPercent = nonNeg(settings.usFederalIncomeTaxPercent);
  const stateCode = (settings.usStateCode || "").toUpperCase();
  const ref = getUsStateTaxRate(stateCode);
  const alternativeTaxOnly = isUsStateWithoutClassicCit(ref);
  const graduated = ref?.rate_type === "graduated";

  const statePercent = alternativeTaxOnly
    ? 0
    : nonNeg(settings.usStateTaxPercent);
  const localPercent = nonNeg(settings.usLocalTaxPercent);

  const deductFactor = 1 - federalPercent / 100;
  const stateAfterFederalDeductionPercent = alternativeTaxOnly
    ? 0
    : statePercent * deductFactor;
  const localAfterFederalDeductionPercent = localPercent * deductFactor;

  const combined = alternativeTaxOnly
    ? federalPercent + localAfterFederalDeductionPercent
    : federalPercent +
      stateAfterFederalDeductionPercent +
      localAfterFederalDeductionPercent;

  return {
    regime: "us",
    federalPercent,
    stateCode,
    stateName: ref?.state_name ?? stateCode,
    stateRateType: ref?.rate_type ?? "",
    statePercent,
    localPercent,
    stateAfterFederalDeductionPercent,
    localAfterFederalDeductionPercent,
    alternativeTaxOnly,
    graduated,
    rateRange: ref?.rate_range ?? null,
    nominalCombinedPercent: combined,
    effectiveCombinedPercent: combined,
    capitalTaxPermille: null,
  };
}

/** @deprecated Alias — nutzt neues Ein-Staat-Modell */
export function usCombinedIncomeTaxPercent(settings: {
  usFederalIncomeTaxPercent: number;
  usStateCode?: string;
  usStateTaxPercent?: number;
  usLocalTaxPercent?: number;
  usTaxJurisdictions?: { incomeTaxPercent: number; apportionmentPercent: number }[];
}): number {
  // Legacy: wenn neues Modell leer und alte Jurisdiktionen existieren
  if (
    !(settings.usStateCode || "").trim() &&
    (settings.usTaxJurisdictions?.length ?? 0) > 0
  ) {
    const federal = nonNeg(settings.usFederalIncomeTaxPercent);
    let state = 0;
    for (const j of settings.usTaxJurisdictions ?? []) {
      const rate = nonNeg(j.incomeTaxPercent);
      const ap = nonNeg(j.apportionmentPercent) / 100;
      state += rate * ap;
    }
    return federal + state;
  }
  return computeUsTaxBreakdown({
    usFederalIncomeTaxPercent: settings.usFederalIncomeTaxPercent,
    usStateCode: settings.usStateCode ?? "",
    usStateTaxPercent: settings.usStateTaxPercent ?? 0,
    usLocalTaxPercent: settings.usLocalTaxPercent ?? 0,
  }).nominalCombinedPercent;
}

export const TaxModelUnitedStates: TaxModel = {
  id: "us",
  compute(settings: CompanySettings): TaxComputationResult {
    return computeUsTaxBreakdown(settings);
  },
};
