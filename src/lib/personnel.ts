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

/** Monate zwischen zwei Hire-Events; null = kein weiteres Wachstum. */
export function hireIntervalMonths(
  frequency: PersonnelHireFrequency,
): number | null {
  switch (frequency) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "semiannual":
      return 6;
    case "yearly":
      return 12;
    case "once":
      return null;
    default:
      return null;
  }
}

function parseMonthKeyLocal(
  month: string,
): { year: number; monthIndex: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return null;
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) return null;
  return { year, monthIndex };
}

function monthOffset(fromKey: string, toKey: string): number | null {
  const from = parseMonthKeyLocal(fromKey);
  const to = parseMonthKeyLocal(toKey);
  if (!from || !to) return null;
  return (to.year - from.year) * 12 + (to.monthIndex - from.monthIndex);
}

/** Rolle aktiv in Kalendermonat YYYY-MM? */
export function isRoleActiveInMonth(
  role: PersonnelRole,
  monthKey: string,
): boolean {
  const parsed = parseMonthKeyLocal(monthKey);
  if (!parsed) return false;
  const start = new Date(parsed.year, parsed.monthIndex, 1);
  const end = new Date(parsed.year, parsed.monthIndex + 1, 0);
  const from = role.gueltigVon
    ? (() => {
        const d = new Date(`${role.gueltigVon}T00:00:00`);
        return Number.isNaN(d.getTime()) ? null : d;
      })()
    : null;
  const to = role.gueltigBis
    ? (() => {
        const d = new Date(`${role.gueltigBis}T00:00:00`);
        return Number.isNaN(d.getTime()) ? null : d;
      })()
    : null;
  if (from && end < from) return false;
  if (to && start > to) return false;
  return true;
}

/** Erster aktiver Monat der Rolle innerhalb der Matrix-Monate. */
export function roleStartMonthKey(
  role: PersonnelRole,
  months: string[],
): string | null {
  for (const month of months) {
    if (isRoleActiveInMonth(role, month)) return month;
  }
  return null;
}

/**
 * Headcount einer Rolle in einem Kalendermonat (inkl. Scaling).
 * `startMonthKey` = erster aktiver Monat; null → 0.
 */
export function headcountForMonth(
  role: PersonnelRole,
  monthKey: string,
  startMonthKey: string | null,
): number {
  if (!startMonthKey || !isRoleActiveInMonth(role, monthKey)) return 0;
  const offset = monthOffset(startMonthKey, monthKey);
  if (offset === null || offset < 0) return 0;

  const base = Math.max(0, role.headcount || 0);
  if (role.roleType !== "scaling") return base;

  const interval = hireIntervalMonths(role.hireFrequency);
  const hiresPer = Math.max(0, role.hiresPerPeriod || 0);
  let hc = base;
  if (interval && interval > 0 && hiresPer > 0 && offset > 0) {
    const events = Math.floor(offset / interval);
    hc = base + events * hiresPer;
  }
  const max = role.maxHeadcount;
  if (typeof max === "number" && Number.isFinite(max) && max > 0) {
    hc = Math.min(hc, max);
  }
  return hc;
}

/** Monatl. Pakete für gegebenen Headcount. */
export function monthlyPackagesForHeadcount(
  role: PersonnelRole,
  headcount: number,
): number {
  const hc = Math.max(0, headcount);
  let sum = 0;
  for (const dep of role.dependencies ?? []) {
    if (dep.cadence !== "monatlich") continue;
    const amount = Math.max(0, dep.amount || 0);
    sum += dep.scalesWithHeadcount ? amount * hc : amount;
  }
  return sum;
}

/** Einmalige Pakete für neu eingestellte FTEs. */
export function oneTimePackagesForHires(
  role: PersonnelRole,
  hiredFte: number,
): number {
  const hired = Math.max(0, hiredFte);
  if (hired <= 0) return 0;
  let sum = 0;
  for (const dep of role.dependencies ?? []) {
    if (dep.cadence !== "einmalig") continue;
    const amount = Math.max(0, dep.amount || 0);
    sum += dep.scalesWithHeadcount ? amount * hired : amount;
  }
  return sum;
}

/**
 * CTC je FTE im Monat, optional mit jährlicher Gehaltssteigerung
 * ab Rollenstart.
 */
export function employerCostPerFteInMonth(
  role: PersonnelRole,
  monthKey: string,
  startMonthKey: string | null,
): number {
  const base = employerCostPerFte(role);
  if (!startMonthKey) return base;
  const offset = monthOffset(startMonthKey, monthKey);
  if (offset === null || offset < 0) return base;
  const years = Math.floor(offset / 12);
  const rate = Math.max(0, role.annualIncreasePercent || 0) / 100;
  if (years <= 0 || rate <= 0) return base;
  return base * (1 + rate) ** years;
}

export type PersonnelMonthCell = {
  headcount: number;
  /** Gehalt+NK+Benefits+monatl. Pakete (ohne Einmalkosten) */
  cost: number;
  /** Einmalige Hire-Pakete in diesem Monat */
  oneTimeCost: number;
  /** Neu eingestellte FTE in diesem Monat */
  hired: number;
};

export function personnelCellForMonth(
  role: PersonnelRole,
  monthKey: string,
  startMonthKey: string | null,
  previousHeadcount: number,
): PersonnelMonthCell {
  const headcount = headcountForMonth(role, monthKey, startMonthKey);
  if (headcount <= 0) {
    return { headcount: 0, cost: 0, oneTimeCost: 0, hired: 0 };
  }
  const hired = Math.max(0, headcount - Math.max(0, previousHeadcount));
  const ctc = employerCostPerFteInMonth(role, monthKey, startMonthKey);
  const cost =
    ctc * headcount + monthlyPackagesForHeadcount(role, headcount);
  const oneTimeCost = oneTimePackagesForHires(role, hired);
  return { headcount, cost, oneTimeCost, hired };
}

export type PersonnelMatrixRoleRow = {
  role: PersonnelRole;
  teamId: string;
  cells: PersonnelMonthCell[];
};

export type PersonnelMatrixTeamGroup = {
  teamId: string;
  label: string;
  roles: PersonnelMatrixRoleRow[];
  /** Summe laufende Kosten je Monat (Rollen im Team) */
  costByMonth: number[];
  /** Summe Einmalkosten je Monat (Rollen im Team) */
  oneTimeByMonth: number[];
  /** Summe Headcount je Monat */
  headcountByMonth: number[];
};

export type PersonnelMonthlyMatrix = {
  months: string[];
  groups: PersonnelMatrixTeamGroup[];
  /** Gesamt-Headcount je Monat */
  headcountTotal: number[];
  /** Neueinstellungen (FTE-Zuwachs) je Monat */
  hiredTotal: number[];
  /** Laufende Personalkosten je Monat */
  costTotal: number[];
  /** Einmalige Hire-Pakete je Monat */
  oneTimeTotal: number[];
};

/**
 * Monatsmatrix: Headcount + Personalkosten je Rolle über Modellmonate.
 */
export function buildPersonnelMonthlyMatrix(
  roles: PersonnelRole[],
  months: string[],
  teams: PersonnelTeam[],
  unassignedLabel: string,
): PersonnelMonthlyMatrix {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const sortedTeams = [...teams].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const rows: PersonnelMatrixRoleRow[] = roles.map((role) => {
    const start = roleStartMonthKey(role, months);
    const cells: PersonnelMonthCell[] = [];
    let prev = 0;
    for (const month of months) {
      const cell = personnelCellForMonth(role, month, start, prev);
      cells.push(cell);
      prev = cell.headcount;
    }
    return {
      role,
      teamId: role.teamId && teamById.has(role.teamId) ? role.teamId : "",
      cells,
    };
  });

  const groups: PersonnelMatrixTeamGroup[] = [];
  const pushGroup = (teamId: string, label: string, groupRows: PersonnelMatrixRoleRow[]) => {
    if (groupRows.length === 0) return;
    const costByMonth = months.map((_, i) =>
      groupRows.reduce((s, r) => s + r.cells[i]!.cost, 0),
    );
    const oneTimeByMonth = months.map((_, i) =>
      groupRows.reduce((s, r) => s + r.cells[i]!.oneTimeCost, 0),
    );
    const headcountByMonth = months.map((_, i) =>
      groupRows.reduce((s, r) => s + r.cells[i]!.headcount, 0),
    );
    groups.push({
      teamId,
      label,
      roles: groupRows.sort((a, b) => a.role.name.localeCompare(b.role.name)),
      costByMonth,
      oneTimeByMonth,
      headcountByMonth,
    });
  };

  for (const team of sortedTeams) {
    pushGroup(
      team.id,
      team.name,
      rows.filter((r) => r.teamId === team.id),
    );
  }
  pushGroup(
    "",
    unassignedLabel,
    rows.filter((r) => !r.teamId),
  );

  const headcountTotal = months.map((_, i) =>
    rows.reduce((s, r) => s + r.cells[i]!.headcount, 0),
  );
  const hiredTotal = months.map((_, i) =>
    rows.reduce((s, r) => s + r.cells[i]!.hired, 0),
  );
  const costTotal = months.map((_, i) =>
    rows.reduce((s, r) => s + r.cells[i]!.cost, 0),
  );
  const oneTimeTotal = months.map((_, i) =>
    rows.reduce((s, r) => s + r.cells[i]!.oneTimeCost, 0),
  );

  return {
    months,
    groups,
    headcountTotal,
    hiredTotal,
    costTotal,
    oneTimeTotal,
  };
}

/**
 * Monatliche Matrix auf Kalenderjahre verdichten:
 * Kosten = Summe der Monate, Headcount = Stand im letzten Monat des Jahres.
 */
export function aggregatePersonnelMatrixByYear(
  matrix: PersonnelMonthlyMatrix,
): PersonnelMonthlyMatrix {
  const yearIndex = new Map<string, number[]>();
  for (let i = 0; i < matrix.months.length; i++) {
    const year = matrix.months[i]!.slice(0, 4);
    const list = yearIndex.get(year) ?? [];
    list.push(i);
    yearIndex.set(year, list);
  }
  const years = [...yearIndex.keys()].sort();

  const pick = (values: number[], indices: number[], mode: "sum" | "last") => {
    if (mode === "sum") {
      return indices.reduce((s, i) => s + (values[i] ?? 0), 0);
    }
    const last = indices[indices.length - 1]!;
    return values[last] ?? 0;
  };

  const groups = matrix.groups.map((group) => ({
    ...group,
    roles: group.roles.map((row) => ({
      ...row,
      cells: years.map((year) => {
        const indices = yearIndex.get(year)!;
        const cost = indices.reduce(
          (s, i) => s + (row.cells[i]?.cost ?? 0),
          0,
        );
        const oneTimeCost = indices.reduce(
          (s, i) => s + (row.cells[i]?.oneTimeCost ?? 0),
          0,
        );
        const last = indices[indices.length - 1]!;
        const headcount = row.cells[last]?.headcount ?? 0;
        const hired = indices.reduce(
          (s, i) => s + (row.cells[i]?.hired ?? 0),
          0,
        );
        return { headcount, cost, oneTimeCost, hired };
      }),
    })),
    costByMonth: years.map((year) =>
      pick(group.costByMonth, yearIndex.get(year)!, "sum"),
    ),
    oneTimeByMonth: years.map((year) =>
      pick(group.oneTimeByMonth, yearIndex.get(year)!, "sum"),
    ),
    headcountByMonth: years.map((year) =>
      pick(group.headcountByMonth, yearIndex.get(year)!, "last"),
    ),
  }));

  return {
    months: years,
    groups,
    headcountTotal: years.map((year) =>
      pick(matrix.headcountTotal, yearIndex.get(year)!, "last"),
    ),
    hiredTotal: years.map((year) =>
      pick(matrix.hiredTotal, yearIndex.get(year)!, "sum"),
    ),
    costTotal: years.map((year) =>
      pick(matrix.costTotal, yearIndex.get(year)!, "sum"),
    ),
    oneTimeTotal: years.map((year) =>
      pick(matrix.oneTimeTotal, yearIndex.get(year)!, "sum"),
    ),
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
    raw?.kategorie === "vertriebsgemeinkosten" ||
    raw?.kategorie === "lagerungsgemeinkosten"
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
