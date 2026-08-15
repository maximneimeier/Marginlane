import { describe, expect, it } from "vitest";
import {
  derivePersonnelAggregatesFromLines,
  normalizeCompanySettings,
  normalizePersonnelDefaultLines,
} from "@/lib/companySettings";
import { EMPTY_COMPANY_SETTINGS } from "@/lib/types";

describe("personnel default lines", () => {
  it("aggregates mandatory %, benefit %, and fixed benefits", () => {
    const agg = derivePersonnelAggregatesFromLines([
      {
        id: "1",
        name: "SS",
        kind: "mandatory",
        unit: "percent",
        value: 6.2,
      },
      {
        id: "2",
        name: "401k",
        kind: "benefit",
        unit: "percent",
        value: 2,
      },
      {
        id: "3",
        name: "Health",
        kind: "benefit",
        unit: "annual",
        value: 1200,
      },
      {
        id: "4",
        name: "Commute",
        kind: "benefit",
        unit: "monthly",
        value: 50,
      },
    ]);
    expect(agg.defaultLohnnebenkostenPercent).toBe(6.2);
    expect(agg.defaultZusatzAgPercent).toBe(2);
    expect(agg.defaultBenefitsMonthly).toBe(150);
  });

  it("starts empty for fresh settings", () => {
    const settings = normalizeCompanySettings({
      ...EMPTY_COMPANY_SETTINGS,
      personnelDefaultLines: [],
    });
    expect(settings.personnelDefaultLines).toEqual([]);
    expect(settings.defaultLohnnebenkostenPercent).toBe(0);
  });

  it("migrates legacy scalar fields into lines", () => {
    const lines = normalizePersonnelDefaultLines({
      defaultSocialSecurityPercent: 6.2,
      defaultMedicarePercent: 1.45,
      defaultHealthInsuranceAnnual: 7200,
      default401kMatchPercent: 2,
    } as never);
    expect(lines.some((l) => l.name === "Social Security" && l.value === 6.2)).toBe(
      true,
    );
    expect(lines.some((l) => l.name === "Health Insurance" && l.unit === "annual")).toBe(
      true,
    );
    expect(lines.some((l) => l.name === "401(k) match" && l.unit === "percent")).toBe(
      true,
    );
  });
});
