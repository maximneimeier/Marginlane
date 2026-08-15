import type { CompanySettings } from "@/lib/types";
import type { TaxComputationResult, TaxModel } from "./types";

export type GermanTaxBreakdown = TaxComputationResult & {
  regime: "de";
  koerperschaftsteuerPercent: number;
  solidaritaetszuschlagPercent: number;
  /** Soli absolut in %-Punkten auf den Gewinn = KSt × Soli% / 100 */
  soliAbsolutePercent: number;
  /** KSt inkl. Soli */
  kstWithSoliPercent: number;
  gewerbesteuerMesszahlPercent: number;
  gewerbesteuerHebesatz: number;
  gewerbesteuerEffectivePercent: number;
};

/** Effektive GewSt % = Messzahl × Hebesatz / 100 */
export function deEffectiveGewerbesteuerPercent(settings: {
  gewerbesteuerMesszahlPercent: number;
  gewerbesteuerHebesatz: number;
}): number {
  const messzahl = Math.max(0, settings.gewerbesteuerMesszahlPercent || 0);
  const hebesatz = Math.max(0, settings.gewerbesteuerHebesatz || 0);
  return (messzahl * hebesatz) / 100;
}

export function computeGermanTaxBreakdown(settings: {
  koerperschaftsteuerPercent: number;
  solidaritaetszuschlagPercent: number;
  gewerbesteuerMesszahlPercent: number;
  gewerbesteuerHebesatz: number;
}): GermanTaxBreakdown {
  const koerperschaftsteuerPercent = Math.max(
    0,
    settings.koerperschaftsteuerPercent || 0,
  );
  const solidaritaetszuschlagPercent = Math.max(
    0,
    settings.solidaritaetszuschlagPercent || 0,
  );
  const gewerbesteuerMesszahlPercent = Math.max(
    0,
    settings.gewerbesteuerMesszahlPercent || 0,
  );
  const gewerbesteuerHebesatz = Math.max(
    0,
    settings.gewerbesteuerHebesatz || 0,
  );

  const soliAbsolutePercent =
    (koerperschaftsteuerPercent * solidaritaetszuschlagPercent) / 100;
  const kstWithSoliPercent =
    koerperschaftsteuerPercent + soliAbsolutePercent;
  const gewerbesteuerEffectivePercent = deEffectiveGewerbesteuerPercent({
    gewerbesteuerMesszahlPercent,
    gewerbesteuerHebesatz,
  });
  const combined = kstWithSoliPercent + gewerbesteuerEffectivePercent;

  return {
    regime: "de",
    koerperschaftsteuerPercent,
    solidaritaetszuschlagPercent,
    soliAbsolutePercent,
    kstWithSoliPercent,
    gewerbesteuerMesszahlPercent,
    gewerbesteuerHebesatz,
    gewerbesteuerEffectivePercent,
    nominalCombinedPercent: combined,
    /**
     * Planung: Abzugsfähigkeit der GewSt wird hier nicht modelliert
     * (vereinfacht nominal === effective).
     */
    effectiveCombinedPercent: combined,
    capitalTaxPermille: null,
  };
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
  return computeGermanTaxBreakdown(settings).nominalCombinedPercent;
}

export const TaxModelGermany: TaxModel = {
  id: "de",
  compute(settings: CompanySettings): TaxComputationResult {
    return computeGermanTaxBreakdown(settings);
  },
};
