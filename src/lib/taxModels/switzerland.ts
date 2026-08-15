import type { CompanySettings } from "@/lib/types";
import type {
  TaxComputationResult,
  TaxModel,
  TaxPlausibilityResult,
} from "./types";

export type SwissTaxInputs = {
  federalPercent: number;
  /** Kantonaler Gewinnsteuer-Grundtarif % */
  cantonalBasePercent: number;
  /** Kantonaler Steuerfuss % (Multiplikator) */
  cantonalTaxFootPercent: number;
  /** Gemeindlicher Steuerfuss % */
  municipalTaxFootPercent: number;
  capitalTaxEnabled: boolean;
  /** Kapitalsteuer in Promille (‰) */
  capitalTaxPermille: number;
};

export type SwissTaxBreakdown = TaxComputationResult & {
  regime: "ch";
  federalPercent: number;
  cantonalBasePercent: number;
  cantonalTaxFootPercent: number;
  municipalTaxFootPercent: number;
  /** Kantonale Gewinnsteuer effektiv = Grundtarif × kantonaler Steuerfuss / 100 */
  cantonalEffectivePercent: number;
  /** Gemeindliche Gewinnsteuer = Grundtarif × Gemeindesteuerfuss / 100 */
  municipalEffectivePercent: number;
};

function nonNeg(n: number): number {
  return Math.max(0, Number.isFinite(n) ? n : 0);
}

/**
 * Effektiver Steuersatz bei abzugsfähiger Gewinnsteuer.
 * Bei nominalem Satz t% (z. B. 13,05): t_eff = t / (1 + t/100).
 *
 * Definition für Marginlane-Planung: Steueraufwand / Vorsteuergewinn,
 * wenn die Gewinnsteuern bei der Ermittlung des steuerbaren Gewinns
 * selbst abzugsfähig sind.
 */
export function swissEffectiveFromNominalPercent(
  nominalPercent: number,
): number {
  const t = nonNeg(nominalPercent);
  if (t === 0) return 0;
  return t / (1 + t / 100);
}

export function swissTaxInputsFromSettings(
  settings: Pick<
    CompanySettings,
    | "chFederalTaxPercent"
    | "chCantonalTaxPercent"
    | "chCantonalTaxFoot"
    | "chMunicipalTaxFoot"
    | "chCapitalTaxEnabled"
    | "chCapitalTaxPermille"
  >,
): SwissTaxInputs {
  return {
    federalPercent: nonNeg(settings.chFederalTaxPercent),
    cantonalBasePercent: nonNeg(settings.chCantonalTaxPercent),
    cantonalTaxFootPercent: nonNeg(settings.chCantonalTaxFoot),
    municipalTaxFootPercent: nonNeg(settings.chMunicipalTaxFoot),
    capitalTaxEnabled: Boolean(settings.chCapitalTaxEnabled),
    capitalTaxPermille: nonNeg(settings.chCapitalTaxPermille),
  };
}

export function computeSwissTaxBreakdown(
  inputs: SwissTaxInputs,
): SwissTaxBreakdown {
  const federalPercent = nonNeg(inputs.federalPercent);
  const cantonalBasePercent = nonNeg(inputs.cantonalBasePercent);
  const cantonalTaxFootPercent = nonNeg(inputs.cantonalTaxFootPercent);
  const municipalTaxFootPercent = nonNeg(inputs.municipalTaxFootPercent);

  const cantonalEffectivePercent =
    (cantonalBasePercent * cantonalTaxFootPercent) / 100;
  const municipalEffectivePercent =
    (cantonalBasePercent * municipalTaxFootPercent) / 100;

  const nominalCombinedPercent =
    federalPercent + cantonalEffectivePercent + municipalEffectivePercent;

  const effectiveCombinedPercent =
    swissEffectiveFromNominalPercent(nominalCombinedPercent);

  const capitalTaxPermille = inputs.capitalTaxEnabled
    ? nonNeg(inputs.capitalTaxPermille)
    : null;

  return {
    regime: "ch",
    federalPercent,
    cantonalBasePercent,
    cantonalTaxFootPercent,
    municipalTaxFootPercent,
    cantonalEffectivePercent,
    municipalEffectivePercent,
    nominalCombinedPercent,
    effectiveCombinedPercent,
    capitalTaxPermille,
  };
}

export function computeSwissTax(
  settings: CompanySettings,
): SwissTaxBreakdown {
  return computeSwissTaxBreakdown(swissTaxInputsFromSettings(settings));
}

/**
 * Plausibilitätsprüfung — warnt nur, überschreibt nie Eingaben.
 * Bereiche sind Planungsheuristiken, keine amtlichen Grenzen.
 */
export function assessSwissTaxPlausibility(
  breakdown: SwissTaxBreakdown,
): TaxPlausibilityResult {
  const flags: string[] = [];
  const {
    federalPercent,
    cantonalBasePercent,
    cantonalTaxFootPercent,
    municipalTaxFootPercent,
    nominalCombinedPercent,
    capitalTaxPermille,
  } = breakdown;

  if (federalPercent < 7 || federalPercent > 10) {
    flags.push("federal");
  }
  if (cantonalBasePercent > 0 && (cantonalBasePercent < 0.5 || cantonalBasePercent > 12)) {
    flags.push("cantonalBase");
  }
  if (
    cantonalTaxFootPercent > 0 &&
    (cantonalTaxFootPercent < 40 || cantonalTaxFootPercent > 200)
  ) {
    flags.push("cantonalFoot");
  }
  if (
    municipalTaxFootPercent > 0 &&
    (municipalTaxFootPercent < 20 || municipalTaxFootPercent > 200)
  ) {
    flags.push("municipalFoot");
  }
  if (nominalCombinedPercent > 0 && (nominalCombinedPercent < 8 || nominalCombinedPercent > 30)) {
    flags.push("nominalTotal");
  }
  if (
    capitalTaxPermille != null &&
    capitalTaxPermille > 0 &&
    (capitalTaxPermille < 0.01 || capitalTaxPermille > 10)
  ) {
    flags.push("capitalTax");
  }

  if (flags.length > 0) {
    return {
      level: "warn",
      messageKey:
        flags.length === 1 && flags[0] === "nominalTotal"
          ? "company.ch.plausibility.warn"
          : "company.ch.plausibility.warnParams",
      flags,
    };
  }

  return {
    level: "ok",
    messageKey: "company.ch.plausibility.ok",
    flags: [],
  };
}

export const TaxModelSwitzerland: TaxModel = {
  id: "ch",
  compute(settings: CompanySettings): TaxComputationResult {
    return computeSwissTax(settings);
  },
};
