import { createId } from "./format";
import type {
  OverheadItem,
  PersonnelCadence,
  PersonnelDependency,
  PersonnelHireFrequency,
  PersonnelRole,
  PersonnelRoleType,
  PersonnelTeam,
} from "./types";
import {
  DEFAULT_LOHNNEBENKOSTEN_PERCENT,
  PERSONNEL_CADENCES,
  PERSONNEL_HIRE_FREQUENCIES,
  PERSONNEL_ROLE_TYPES,
} from "./types";

export function isPersonnelCadence(value: unknown): value is PersonnelCadence {
  return (
    typeof value === "string" &&
    (PERSONNEL_CADENCES as string[]).includes(value)
  );
}

export function isPersonnelRoleType(value: unknown): value is PersonnelRoleType {
  return (
    typeof value === "string" &&
    (PERSONNEL_ROLE_TYPES as string[]).includes(value)
  );
}

export function isPersonnelHireFrequency(
  value: unknown,
): value is PersonnelHireFrequency {
  return (
    typeof value === "string" &&
    (PERSONNEL_HIRE_FREQUENCIES as string[]).includes(value)
  );
}

/** Brutto × Jahr */
export function annualSalary(role: PersonnelRole): number {
  return Math.max(0, role.bruttoGehalt || 0) * 12;
}

/** Firmen-Personal-Defaults auf eine Rolle anwenden (NK, Benefits, Steigerung). */
export function withCompanyPersonnelDefaults(
  role: PersonnelRole,
  defaults: {
    lohnnebenkostenPercent: number;
    zusatzAgPercent: number;
    benefitsMonthly: number;
    annualIncreasePercent: number;
  },
): PersonnelRole {
  return {
    ...role,
    lohnnebenkostenPercent: Math.max(0, defaults.lohnnebenkostenPercent || 0),
    zusatzAgPercent: Math.max(0, defaults.zusatzAgPercent || 0),
    benefitsMonthly: Math.max(0, defaults.benefitsMonthly || 0),
    annualIncreasePercent: Math.max(0, defaults.annualIncreasePercent || 0),
  };
}

/**
 * AG-Kosten je FTE / Monat:
 * Brutto × (1 + NK% + Zusatz%) + Benefits/Monat.
 */
export function employerCostPerFte(role: PersonnelRole): number {
  return employerCostBreakdown(role).total;
}

/** Aufschlüsselung der AG-Kosten je FTE / Monat. */
export function employerCostBreakdown(role: PersonnelRole): {
  brutto: number;
  nkPercent: number;
  zusatzPercent: number;
  nkAmount: number;
  zusatzAmount: number;
  benefits: number;
  total: number;
} {
  const brutto = Math.max(0, role.bruttoGehalt || 0);
  const nkPercent = Math.max(0, role.lohnnebenkostenPercent || 0);
  const zusatzPercent = Math.max(0, role.zusatzAgPercent || 0);
  const benefits = Math.max(0, role.benefitsMonthly || 0);
  const nkAmount = brutto * (nkPercent / 100);
  const zusatzAmount = brutto * (zusatzPercent / 100);
  return {
    brutto,
    nkPercent,
    zusatzPercent,
    nkAmount,
    zusatzAmount,
    benefits,
    total: brutto + nkAmount + zusatzAmount + benefits,
  };
}

/** Nur Lohnnebenkosten + Zusatz + Benefits je FTE / Monat (ohne Brutto). */
export function employerBurdenPerFte(role: PersonnelRole): number {
  const brutto = Math.max(0, role.bruttoGehalt || 0);
  const nk = Math.max(0, role.lohnnebenkostenPercent || 0);
  const zusatz = Math.max(0, role.zusatzAgPercent || 0);
  const benefits = Math.max(0, role.benefitsMonthly || 0);
  return brutto * ((nk + zusatz) / 100) + benefits;
}

/** Monatliche Paketkosten für aktuellen Headcount (ohne Gehalt). */
export function monthlyDependencyTotal(role: PersonnelRole): number {
  const hc = Math.max(0, role.headcount || 0);
  let sum = 0;
  for (const dep of role.dependencies ?? []) {
    if (dep.cadence !== "monatlich") continue;
    const amount = Math.max(0, dep.amount || 0);
    sum += dep.scalesWithHeadcount ? amount * hc : amount;
  }
  return sum;
}

/** Wiederkehrende Personalkosten / Monat (CTC × HC + monatl. Pakete). */
export function recurringMonthlyTotal(role: PersonnelRole): number {
  const hc = Math.max(0, role.headcount || 0);
  return employerCostPerFte(role) * hc + monthlyDependencyTotal(role);
}

/**
 * Kosten einer zusätzlichen Person (FTE +1):
 * CTC + skalierende monatl. Pakete + einmalige Pakete.
 */
export function hireExtraPersonCost(role: PersonnelRole): {
  salary: number;
  monthlyPackages: number;
  oneTime: number;
  totalFirstMonth: number;
  totalRecurringDelta: number;
} {
  const salary = employerCostPerFte(role);
  let monthlyPackages = 0;
  let oneTime = 0;
  for (const dep of role.dependencies ?? []) {
    const amount = Math.max(0, dep.amount || 0);
    if (dep.cadence === "monatlich") {
      if (dep.scalesWithHeadcount) monthlyPackages += amount;
    } else if (dep.scalesWithHeadcount) {
      oneTime += amount;
    }
  }
  const totalRecurringDelta = salary + monthlyPackages;
  return {
    salary,
    monthlyPackages,
    oneTime,
    totalRecurringDelta,
    totalFirstMonth: totalRecurringDelta + oneTime,
  };
}

/** Expandiert Rollen zu Plan-Gemeinkostenzeilen (nur wiederkehrend). */
export function expandPersonnelRolesToOverheadItems(
  roles: PersonnelRole[],
): OverheadItem[] {
  const out: OverheadItem[] = [];
  for (const role of roles) {
    const hc = Math.max(0, role.headcount || 0);
    const employer = employerCostPerFte(role) * hc;
    if (employer > 0) {
      out.push({
        id: `prs_${role.id}_salary`,
        name: `${role.name} (Gehalt+NK)`,
        betrag: employer,
        waehrung: role.waehrung || "EUR",
        periode: "monatlich",
        kategorie: role.kategorie,
        kostenart: "fix",
        variableBasis: null,
        variableRate: null,
        verteilschluessel: role.verteilschluessel,
        manuelleAufteilung: role.manuelleAufteilung,
        gueltigVon: role.gueltigVon,
        gueltigBis: role.gueltigBis,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        updatedBy: role.updatedBy,
      });
    }
    for (const dep of role.dependencies ?? []) {
      if (dep.cadence !== "monatlich") continue;
      const amount = Math.max(0, dep.amount || 0);
      const betrag = dep.scalesWithHeadcount ? amount * hc : amount;
      if (betrag <= 0) continue;
      out.push({
        id: `prs_${role.id}_dep_${dep.id}`,
        name: `${role.name}: ${dep.name}`,
        betrag,
        waehrung: role.waehrung || "EUR",
        periode: "monatlich",
        kategorie: role.kategorie,
        kostenart: "fix",
        variableBasis: null,
        variableRate: null,
        verteilschluessel: role.verteilschluessel,
        manuelleAufteilung: role.manuelleAufteilung,
        gueltigVon: role.gueltigVon,
        gueltigBis: role.gueltigBis,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        updatedBy: role.updatedBy,
      });
    }
  }
  return out;
}

export function emptyPersonnelDependency(
  partial?: Partial<PersonnelDependency>,
): PersonnelDependency {
  return {
    id: createId("pdep"),
    name: "",
    amount: 0,
    cadence: "monatlich",
    scalesWithHeadcount: true,
    ...partial,
  };
}

export function defaultPersonnelDependencies(): PersonnelDependency[] {
  return [
    emptyPersonnelDependency({
      name: "Laptop",
      amount: 1200,
      cadence: "einmalig",
      scalesWithHeadcount: true,
    }),
    emptyPersonnelDependency({
      name: "Büroplatz",
      amount: 350,
      cadence: "monatlich",
      scalesWithHeadcount: true,
    }),
    emptyPersonnelDependency({
      name: "Onboarding / Vertrag",
      amount: 400,
      cadence: "einmalig",
      scalesWithHeadcount: true,
    }),
  ];
}

export function emptyPersonnelTeam(): PersonnelTeam {
  const now = new Date().toISOString();
  return {
    id: createId("ptm"),
    name: "",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizePersonnelTeam(
  raw: Partial<PersonnelTeam> | null | undefined,
): PersonnelTeam {
  const now = new Date().toISOString();
  return {
    id: typeof raw?.id === "string" && raw.id ? raw.id : createId("ptm"),
    name: typeof raw?.name === "string" ? raw.name : "",
    notes: typeof raw?.notes === "string" ? raw.notes : "",
    createdAt:
      typeof raw?.createdAt === "string" && raw.createdAt
        ? raw.createdAt
        : now,
    updatedAt:
      typeof raw?.updatedAt === "string" && raw.updatedAt
        ? raw.updatedAt
        : now,
  };
}

export function emptyPersonnelRole(
  currency = "EUR",
  defaults?: Partial<{
    lohnnebenkostenPercent: number;
    zusatzAgPercent: number;
    benefitsMonthly: number;
    annualIncreasePercent: number;
  }>,
): PersonnelRole {
  const now = new Date().toISOString();
  return {
    id: createId("prs"),
    name: "",
    teamId: "",
    bruttoGehalt: 0,
    lohnnebenkostenPercent:
      defaults?.lohnnebenkostenPercent ?? DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent: defaults?.zusatzAgPercent ?? 0,
    benefitsMonthly: defaults?.benefitsMonthly ?? 0,
    annualIncreasePercent: defaults?.annualIncreasePercent ?? 3,
    roleType: "single",
    headcount: 1,
    hiresPerPeriod: 1,
    hireFrequency: "once",
    maxHeadcount: null,
    waehrung: currency,
    kategorie: "verwaltungsgemeinkosten",
    verteilschluessel: "gleichmaessig",
    manuelleAufteilung: null,
    dependencies: defaultPersonnelDependencies(),
    gueltigVon: null,
    gueltigBis: null,
    notes: "",
    createdAt: now,
    updatedAt: now,
    updatedBy: null,
  };
}

export function normalizePersonnelDependency(
  raw: Partial<PersonnelDependency> | null | undefined,
): PersonnelDependency {
  const cadence = isPersonnelCadence(raw?.cadence)
    ? raw!.cadence
    : "monatlich";
  return {
    id: typeof raw?.id === "string" && raw.id ? raw.id : createId("pdep"),
    name: typeof raw?.name === "string" ? raw.name : "",
    amount:
      typeof raw?.amount === "number" && Number.isFinite(raw.amount)
        ? raw.amount
        : 0,
    cadence,
    scalesWithHeadcount: raw?.scalesWithHeadcount !== false,
  };
}

export function normalizePersonnelRole(
  raw: Partial<PersonnelRole> | null | undefined,
): PersonnelRole {
  const now = new Date().toISOString();
  const deps = Array.isArray(raw?.dependencies)
    ? raw!.dependencies.map((d) => normalizePersonnelDependency(d))
    : [];
  const verteil =
    raw?.verteilschluessel === "nach_umsatzanteil" ||
    raw?.verteilschluessel === "nach_stueckzahl" ||
    raw?.verteilschluessel === "manuell" ||
    raw?.verteilschluessel === "gleichmaessig"
      ? raw.verteilschluessel
      : "gleichmaessig";
  const kategorie =
    raw?.kategorie === "materialgemeinkosten" ||
    raw?.kategorie === "fertigungsgemeinkosten" ||
    raw?.kategorie === "verwaltungsgemeinkosten" ||
    raw?.kategorie === "vertriebsgemeinkosten"
      ? raw.kategorie
      : "verwaltungsgemeinkosten";

  return {
    id: typeof raw?.id === "string" && raw.id ? raw.id : createId("prs"),
    name: typeof raw?.name === "string" ? raw.name : "",
    teamId: typeof raw?.teamId === "string" ? raw.teamId : "",
    bruttoGehalt:
      typeof raw?.bruttoGehalt === "number" && Number.isFinite(raw.bruttoGehalt)
        ? raw.bruttoGehalt
        : 0,
    lohnnebenkostenPercent:
      typeof raw?.lohnnebenkostenPercent === "number" &&
      Number.isFinite(raw.lohnnebenkostenPercent)
        ? raw.lohnnebenkostenPercent
        : DEFAULT_LOHNNEBENKOSTEN_PERCENT,
    zusatzAgPercent:
      typeof raw?.zusatzAgPercent === "number" &&
      Number.isFinite(raw.zusatzAgPercent)
        ? raw.zusatzAgPercent
        : 0,
    benefitsMonthly:
      typeof raw?.benefitsMonthly === "number" &&
      Number.isFinite(raw.benefitsMonthly)
        ? raw.benefitsMonthly
        : 0,
    annualIncreasePercent:
      typeof raw?.annualIncreasePercent === "number" &&
      Number.isFinite(raw.annualIncreasePercent)
        ? raw.annualIncreasePercent
        : 3,
    roleType: isPersonnelRoleType(raw?.roleType) ? raw!.roleType : "single",
    headcount:
      typeof raw?.headcount === "number" && Number.isFinite(raw.headcount)
        ? raw.headcount
        : 1,
    hiresPerPeriod:
      typeof raw?.hiresPerPeriod === "number" &&
      Number.isFinite(raw.hiresPerPeriod)
        ? raw.hiresPerPeriod
        : 1,
    hireFrequency: isPersonnelHireFrequency(raw?.hireFrequency)
      ? raw!.hireFrequency
      : "once",
    maxHeadcount:
      typeof raw?.maxHeadcount === "number" && Number.isFinite(raw.maxHeadcount)
        ? raw.maxHeadcount
        : null,
    waehrung:
      typeof raw?.waehrung === "string" && raw.waehrung ? raw.waehrung : "EUR",
    kategorie,
    verteilschluessel: verteil,
    manuelleAufteilung:
      verteil === "manuell" && Array.isArray(raw?.manuelleAufteilung)
        ? raw!.manuelleAufteilung
            .filter(
              (s) =>
                s &&
                typeof s.productId === "string" &&
                typeof s.percent === "number",
            )
            .map((s) => ({
              productId: s.productId,
              percent: s.percent,
            }))
        : null,
    dependencies: deps,
    gueltigVon:
      typeof raw?.gueltigVon === "string" && raw.gueltigVon
        ? raw.gueltigVon
        : null,
    gueltigBis:
      typeof raw?.gueltigBis === "string" && raw.gueltigBis
        ? raw.gueltigBis
        : null,
    notes: typeof raw?.notes === "string" ? raw.notes : "",
    createdAt:
      typeof raw?.createdAt === "string" && raw.createdAt
        ? raw.createdAt
        : now,
    updatedAt:
      typeof raw?.updatedAt === "string" && raw.updatedAt
        ? raw.updatedAt
        : now,
    updatedBy: typeof raw?.updatedBy === "string" ? raw.updatedBy : null,
  };
}
