import type { CompanySettings } from "@/lib/types";
import type { TaxComputationResult, TaxModel } from "./types";

/** Effektive GewSt % = Messzahl × Hebesatz / 100 */
export function deEffectiveGewerbesteuerPercent(settings: {
  gewerbesteuerMesszahlPercent: number;
  gewerbesteuerHebesatz: number;
}): number {
  const messzahl = Math.max(0, settings.gewerbesteuerMesszahlPercent || 0);
  const hebesatz = Math.max(0, settings.gewerbesteuerHebesatz || 0);
  return (messzahl * hebesatz) / 100;
}

/**
 * DE-Gesamtbelastung (vereinfacht, Planung):
 * KSt × (1 + Soli%) + effektive GewSt.
 * Abzugsfähigkeit von GewSt wird hier nicht modelliert (nominal === effective).
 */
export function deCombinedIncomeTaxPercent(settings: {
  koerperschaftsteuerPercent: number;
  solidaritaetszuschlagPercent: number;
  gewerbesteuerMesszahlPercent: number;
  gewerbesteuerHebesatz: number;
}): number {
  const kst = Math.max(0, settings.koerperschaftsteuerPercent || 0);
  const soli = Math.max(0, settings.solidaritaetszuschlagPercent || 0);
  const gewSt = deEffectiveGewerbesteuerPercent(settings);
  return kst * (1 + soli / 100) + gewSt;
}

export const TaxModelGermany: TaxModel = {
  id: "de",
  compute(settings: CompanySettings): TaxComputationResult {
    const rate = deCombinedIncomeTaxPercent(settings);
    return {
      regime: "de",
      nominalCombinedPercent: rate,
      effectiveCombinedPercent: rate,
      capitalTaxPermille: null,
    };
  },
};
