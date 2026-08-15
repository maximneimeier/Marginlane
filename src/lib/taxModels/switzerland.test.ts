import { describe, expect, it } from "vitest";
import {
  assessSwissTaxPlausibility,
  computeIncomeTax,
  computeSwissTaxBreakdown,
  swissEffectiveFromNominalPercent,
} from "@/lib/taxModels";
import { combinedIncomeTaxPercent, normalizeCompanySettings } from "@/lib/companySettings";
import { EMPTY_COMPANY_SETTINGS } from "@/lib/types";

describe("TaxModelSwitzerland", () => {
  it("computes 8.5 / 3.5 / 78 / 52 example", () => {
    const result = computeSwissTaxBreakdown({
      federalPercent: 8.5,
      cantonalBasePercent: 3.5,
      cantonalTaxFootPercent: 78,
      municipalTaxFootPercent: 52,
      capitalTaxEnabled: false,
      capitalTaxPermille: 0,
    });

    expect(result.federalPercent).toBeCloseTo(8.5, 6);
    expect(result.cantonalEffectivePercent).toBeCloseTo(2.73, 6);
    expect(result.municipalEffectivePercent).toBeCloseTo(1.82, 6);
    expect(result.nominalCombinedPercent).toBeCloseTo(13.05, 6);
    expect(result.effectiveCombinedPercent).toBeCloseTo(
      swissEffectiveFromNominalPercent(13.05),
      6,
    );
    expect(result.capitalTaxPermille).toBeNull();
  });

  it("recomputes when cantonal tax foot changes", () => {
    const base = {
      federalPercent: 8.5,
      cantonalBasePercent: 3.5,
      municipalTaxFootPercent: 52,
      capitalTaxEnabled: false,
      capitalTaxPermille: 0,
    };
    const a = computeSwissTaxBreakdown({
      ...base,
      cantonalTaxFootPercent: 78,
    });
    const b = computeSwissTaxBreakdown({
      ...base,
      cantonalTaxFootPercent: 100,
    });

    expect(a.cantonalEffectivePercent).toBeCloseTo(2.73, 6);
    expect(b.cantonalEffectivePercent).toBeCloseTo(3.5, 6);
    expect(b.nominalCombinedPercent).toBeCloseTo(8.5 + 3.5 + 1.82, 6);
  });

  it("recomputes when municipal tax foot changes", () => {
    const a = computeSwissTaxBreakdown({
      federalPercent: 8.5,
      cantonalBasePercent: 3.5,
      cantonalTaxFootPercent: 78,
      municipalTaxFootPercent: 52,
      capitalTaxEnabled: false,
      capitalTaxPermille: 0,
    });
    const b = computeSwissTaxBreakdown({
      federalPercent: 8.5,
      cantonalBasePercent: 3.5,
      cantonalTaxFootPercent: 78,
      municipalTaxFootPercent: 100,
      capitalTaxEnabled: false,
      capitalTaxPermille: 0,
    });

    expect(a.municipalEffectivePercent).toBeCloseTo(1.82, 6);
    expect(b.municipalEffectivePercent).toBeCloseTo(3.5, 6);
  });

  it("keeps capital tax separate from profit tax rates", () => {
    const off = computeSwissTaxBreakdown({
      federalPercent: 8.5,
      cantonalBasePercent: 3.5,
      cantonalTaxFootPercent: 78,
      municipalTaxFootPercent: 52,
      capitalTaxEnabled: false,
      capitalTaxPermille: 1.5,
    });
    const on = computeSwissTaxBreakdown({
      federalPercent: 8.5,
      cantonalBasePercent: 3.5,
      cantonalTaxFootPercent: 78,
      municipalTaxFootPercent: 52,
      capitalTaxEnabled: true,
      capitalTaxPermille: 1.5,
    });

    expect(off.nominalCombinedPercent).toBeCloseTo(on.nominalCombinedPercent, 6);
    expect(off.capitalTaxPermille).toBeNull();
    expect(on.capitalTaxPermille).toBeCloseTo(1.5, 6);
  });

  it("warns on unusual inputs without changing values", () => {
    const odd = computeSwissTaxBreakdown({
      federalPercent: 20,
      cantonalBasePercent: 3.5,
      cantonalTaxFootPercent: 78,
      municipalTaxFootPercent: 52,
      capitalTaxEnabled: false,
      capitalTaxPermille: 0,
    });
    const before = odd.nominalCombinedPercent;
    const assessment = assessSwissTaxPlausibility(odd);

    expect(assessment.level).toBe("warn");
    expect(assessment.flags).toContain("federal");
    expect(odd.nominalCombinedPercent).toBe(before);
  });

  it("marks typical example as plausible", () => {
    const result = computeSwissTaxBreakdown({
      federalPercent: 8.5,
      cantonalBasePercent: 3.5,
      cantonalTaxFootPercent: 78,
      municipalTaxFootPercent: 52,
      capitalTaxEnabled: false,
      capitalTaxPermille: 0,
    });
    expect(assessSwissTaxPlausibility(result).level).toBe("ok");
  });

  it("uses effective rate for CH planning via combinedIncomeTaxPercent", () => {
    const settings = normalizeCompanySettings({
      ...EMPTY_COMPANY_SETTINGS,
      taxRegime: "ch",
      chFederalTaxPercent: 8.5,
      chCantonalTaxPercent: 3.5,
      chCantonalTaxFoot: 78,
      chMunicipalTaxFoot: 52,
    });
    const nominal = 13.05;
    expect(combinedIncomeTaxPercent(settings)).toBeCloseTo(
      swissEffectiveFromNominalPercent(nominal),
      6,
    );
  });

  it("switches regime CH → other without leaking Swiss rate", () => {
    const swiss = normalizeCompanySettings({
      ...EMPTY_COMPANY_SETTINGS,
      taxRegime: "ch",
      chFederalTaxPercent: 8.5,
      chCantonalTaxPercent: 3.5,
      chCantonalTaxFoot: 78,
      chMunicipalTaxFoot: 52,
      corporateTaxPercent: 12,
    });
    const other = normalizeCompanySettings({
      ...swiss,
      taxRegime: "other",
    });

    expect(computeIncomeTax(swiss).regime).toBe("ch");
    expect(computeIncomeTax(other).regime).toBe("other");
    expect(combinedIncomeTaxPercent(other)).toBe(12);
  });

  it("defaults missing cantonal tax foot to 100 on normalize", () => {
    const settings = normalizeCompanySettings({
      taxRegime: "ch",
      chFederalTaxPercent: 8.5,
      chCantonalTaxPercent: 3.5,
      chMunicipalTaxFoot: 52,
    });
    expect(settings.chCantonalTaxFoot).toBe(100);
    expect(settings.chCapitalTaxEnabled).toBe(false);
  });
});

describe("swissEffectiveFromNominalPercent", () => {
  it("applies t / (1 + t/100)", () => {
    expect(swissEffectiveFromNominalPercent(13.05)).toBeCloseTo(
      13.05 / (1 + 13.05 / 100),
      8,
    );
    expect(swissEffectiveFromNominalPercent(0)).toBe(0);
  });
});
