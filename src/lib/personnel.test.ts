import { describe, expect, it } from "vitest";
import {
  employerCostPerFte,
  expandPersonnelRolesToOverheadItems,
  headcountForMonth,
  hireExtraPersonCost,
  buildPersonnelMonthlyMatrix,
  aggregatePersonnelMatrixByYear,
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

describe("personnel monthly scaling", () => {
  const months = [
    "2025-01",
    "2025-02",
    "2025-03",
    "2025-04",
    "2025-07",
    "2026-01",
  ];

  it("keeps single-hire headcount constant while active", () => {
    const r = role({
      roleType: "single",
      headcount: 2,
      gueltigVon: "2025-02-01",
    });
    expect(headcountForMonth(r, "2025-01", "2025-02")).toBe(0);
    expect(headcountForMonth(r, "2025-02", "2025-02")).toBe(2);
    expect(headcountForMonth(r, "2026-01", "2025-02")).toBe(2);
  });

  it("grows scaling roles by hire cadence and respects max", () => {
    const r = role({
      roleType: "scaling",
      headcount: 2,
      hiresPerPeriod: 1,
      hireFrequency: "quarterly",
      maxHeadcount: 4,
      gueltigVon: "2025-01-01",
    });
    expect(headcountForMonth(r, "2025-01", "2025-01")).toBe(2);
    expect(headcountForMonth(r, "2025-02", "2025-01")).toBe(2);
    expect(headcountForMonth(r, "2025-04", "2025-01")).toBe(3);
    expect(headcountForMonth(r, "2025-07", "2025-01")).toBe(4);
    expect(headcountForMonth(r, "2026-01", "2025-01")).toBe(4);
  });

  it("builds matrix totals by month", () => {
    const matrix = buildPersonnelMonthlyMatrix(
      [
        role({
          id: "a",
          name: "A",
          teamId: "t1",
          roleType: "single",
          headcount: 1,
          gueltigVon: "2025-01-01",
        }),
        role({
          id: "b",
          name: "B",
          teamId: "t1",
          roleType: "scaling",
          headcount: 1,
          hiresPerPeriod: 1,
          hireFrequency: "yearly",
          maxHeadcount: 3,
          gueltigVon: "2025-01-01",
        }),
      ],
      months,
      [{ id: "t1", name: "Sales", notes: "", createdAt: "", updatedAt: "" }],
      "Unassigned",
    );
    expect(matrix.headcountTotal[0]).toBe(2);
    expect(matrix.headcountTotal[5]).toBe(3);
    expect(matrix.groups).toHaveLength(1);
    expect(matrix.costTotal[0]).toBeGreaterThan(0);
    // Hire month: Laptop 1200 × 2 FTEs (both roles start with hired > 0)
    expect(matrix.oneTimeTotal[0]).toBe(2400);
    expect(matrix.oneTimeTotal[1]).toBe(0);
    // Recurring cost stays flat for month 0→1 (no new hires)
    expect(matrix.costTotal[0]).toBe(matrix.costTotal[1]);
  });

  it("aggregates monthly matrix into years", () => {
    const monthly = buildPersonnelMonthlyMatrix(
      [
        role({
          id: "a",
          name: "A",
          teamId: "t1",
          roleType: "scaling",
          headcount: 1,
          hiresPerPeriod: 1,
          hireFrequency: "yearly",
          maxHeadcount: 5,
          gueltigVon: "2025-01-01",
        }),
      ],
      ["2025-01", "2025-06", "2025-12", "2026-01", "2026-12"],
      [{ id: "t1", name: "Sales", notes: "", createdAt: "", updatedAt: "" }],
      "Unassigned",
    );
    const yearly = aggregatePersonnelMatrixByYear(monthly);
    expect(yearly.months).toEqual(["2025", "2026"]);
    expect(yearly.headcountTotal[0]).toBe(1);
    expect(yearly.headcountTotal[1]).toBe(2);
    expect(yearly.costTotal[0]).toBeGreaterThan(0);
    expect(yearly.costTotal[1]).toBeGreaterThan(0);
  });
});
