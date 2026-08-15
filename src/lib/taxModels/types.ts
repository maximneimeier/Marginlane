import type { CompanySettings, TaxRegime } from "@/lib/types";

/**
 * Ergebnis eines Länder-Steuermodells.
 *
 * `nominalCombinedPercent`: Summe der Gewinnsteuersätze vor Abzug der Steuer
 * selbst (Schweiz: „nominale Gesamtsteuerbelastung vor Steuerabzug“).
 *
 * `effectiveCombinedPercent`: Steueraufwand relativ zum Vorsteuergewinn,
 * wenn Gewinnsteuern abzugsfähig sind. Schweiz: t / (1 + t/100).
 * Andere Regime können nominal === effective setzen, bis ein eigenes Modell
 * die Abzugsfähigkeit abbildet.
 */
export type TaxComputationResult = {
  regime: TaxRegime;
  nominalCombinedPercent: number;
  effectiveCombinedPercent: number;
  /** Kapitalsteuer in ‰ — nie in die Gewinnsteuersätze eingerechnet */
  capitalTaxPermille: number | null;
};

export type TaxPlausibilityLevel = "ok" | "warn";

export type TaxPlausibilityResult = {
  level: TaxPlausibilityLevel;
  /** i18n-MessageKey ohne Locale-Abhängigkeit in der Lib */
  messageKey:
    | "company.ch.plausibility.ok"
    | "company.ch.plausibility.warn"
    | "company.ch.plausibility.warnParams";
  /** Zusätzliche Flags für Warnungsgründe (UI kann Details zeigen) */
  flags: string[];
};

export type TaxModel = {
  id: TaxRegime;
  compute(settings: CompanySettings): TaxComputationResult;
};
