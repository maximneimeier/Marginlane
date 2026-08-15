import { describe, expect, it } from "vitest";
import {
  employerCostPerFte,
  expandPersonnelRolesToOverheadItems,
  hireExtraPersonCost,
  recurringMonthlyTotal,
} from "@/lib/personnel";
import type { PersonnelRole } from "@/lib/types";
import { DEFAULT_LOHNNEBENKOSTEN_PERCENT } from "@/lib/types";

function role(partial: Partial<PersonnelRole> = {}): PersonnelRole {
  return {
    id: "prs_1",
    name: "CS",
    teamId: "",
    bruttoGehalt: 4000,
    lohnnebenkostenPercent: DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: 2,
    benefitsMonthly: 100,
    annualIncreasePercent: 3,
    roleType: "single",
    headcount: 2,
    hiresPerPeriod: 1,
    hireFrequency: "once",
    maxHeadcount: null,
    waehrung: "EUR",
    kategorie: "verwaltungsgemeinkosten",
    verteilschluessel: "gleichmaessig",
    manuelleAufteilung: null,
    dependencies: [
      {
        id: "d1",
        name: "Laptop",
        amount: 1200,
        cadence: "einmalig",
        scalesWithHeadcount: true,
      },
      {
        id: "d2",
        name: "Desk",
        amount: 350,
        cadence: "monatlich",
        scalesWithHeadcount: true,
      },
    ],
    gueltigVon: null,
    gueltigBis: null,
    notes: "",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    updatedBy: null,
    ...partial,
  };
}

describe("personnel costs", () => {
  it("computes employer CTC with taxes, extras and benefits", () => {
    // 4000 * (1 + 0.22 + 0.02) + 100 = 4000 * 1.24 + 100 = 5060
    expect(employerCostPerFte(role({ lohnnebenkostenPercent: 22 }))).toBe(5060);
  });

  it("sums recurring monthly including packages × headcount", () => {
    // 5060 * 2 + 350 * 2
    expect(recurringMonthlyTotal(role({ lohnnebenkostenPercent: 22 }))).toBe(
      5060 * 2 + 700,
    );
  });

  it("preview +1 person includes CTC, monthly package, one-time", () => {
    const h = hireExtraPersonCost(role({ lohnnebenkostenPercent: 22 }));
    expect(h.salary).toBe(5060);
    expect(h.monthlyPackages).toBe(350);
    expect(h.oneTime).toBe(1200);
    expect(h.totalFirstMonth).toBe(5060 + 350 + 1200);
  });

  it("expands only recurring lines to overhead items", () => {
    const items = expandPersonnelRolesToOverheadItems([
      role({ lohnnebenkostenPercent: 22 }),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].name).toContain("Gehalt+NK");
    expect(items[0].betrag).toBe(5060 * 2);
    expect(items[1].name).toContain("Desk");
    expect(items[1].betrag).toBe(700);
  });

  it("uses 0% as default employer payroll burden when unset", () => {
    // 4000 * (1 + 0 + 0.02) + 100 = 4180
    expect(employerCostPerFte(role())).toBe(4180);
    expect(DEFAULT_LOHNNEBENKOSTEN_PERCENT).toBe(0);
  });
});
