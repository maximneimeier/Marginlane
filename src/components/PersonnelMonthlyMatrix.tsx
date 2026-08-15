"use client";

import { Fragment, useMemo, useState } from "react";
import type { CompanySettings, PersonnelRole, PersonnelTeam } from "@/lib/types";
import {
  monthKeyToEndDate,
  monthKeyToStartDate,
  personnelDefaultsFromCompany,
} from "@/lib/companySettings";
import { monthsKeysInRange } from "@/lib/overhead";
import {
  aggregatePersonnelMatrixByYear,
  buildPersonnelMonthlyMatrix,
  withCompanyPersonnelDefaults,
  type PersonnelMatrixTeamGroup,
} from "@/lib/personnel";
import { formatEuro, formatNumber } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";

type Props = {
  roles: PersonnelRole[];
  teams: PersonnelTeam[];
  companySettings: CompanySettings;
};

type PeriodMode = "month" | "year";

function formatPeriodLabel(
  key: string,
  mode: PeriodMode,
  locale: string,
): string {
  if (mode === "year") return key;
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(locale, { month: "short", year: "2-digit" });
}

export function PersonnelMonthlyMatrix({
  roles,
  teams,
  companySettings,
}: Props) {
  const { t, locale } = useI18n();
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");

  const months = useMemo(() => {
    const from =
      monthKeyToStartDate(companySettings.modelStartMonth) ??
      `${new Date().getFullYear()}-01-01`;
    const to =
      monthKeyToEndDate(companySettings.lastActualMonth) ??
      `${new Date().getFullYear()}-12-31`;
    return monthsKeysInRange({ from, to });
  }, [companySettings.modelStartMonth, companySettings.lastActualMonth]);

  const pricedRoles = useMemo(() => {
    const defaults = personnelDefaultsFromCompany(companySettings);
    return roles.map((role) => withCompanyPersonnelDefaults(role, defaults));
  }, [roles, companySettings]);

  const monthlyMatrix = useMemo(
    () =>
      buildPersonnelMonthlyMatrix(
        pricedRoles,
        months,
        teams,
        t("personnel.team.unassigned"),
      ),
    [pricedRoles, months, teams, t],
  );

  const matrix = useMemo(
    () =>
      periodMode === "year"
        ? aggregatePersonnelMatrixByYear(monthlyMatrix)
        : monthlyMatrix,
    [monthlyMatrix, periodMode],
  );

  if (roles.length === 0 || months.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
            {periodMode === "month"
              ? t("personnel.matrix.titleMonth")
              : t("personnel.matrix.titleYear")}
          </h3>
          <p className="mt-0.5 text-[12px] text-muted">
            {periodMode === "month"
              ? t("personnel.matrix.hintMonth")
              : t("personnel.matrix.hintYear")}
          </p>
        </div>
        <div className="flex shrink-0 rounded-[8px] border border-line bg-white p-0.5">
          <button
            type="button"
            onClick={() => setPeriodMode("month")}
            className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
              periodMode === "month"
                ? "bg-surface-soft text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t("personnel.matrix.mode.month")}
          </button>
          <button
            type="button"
            onClick={() => setPeriodMode("year")}
            className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
              periodMode === "year"
                ? "bg-surface-soft text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t("personnel.matrix.mode.year")}
          </button>
        </div>
      </div>

      <div className="rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-line bg-[#1e4d8c] text-white">
                <th className="sticky left-0 z-20 bg-[#1e4d8c] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em]">
                  {t("personnel.matrix.col.role")}
                </th>
                {matrix.months.map((period) => (
                  <th
                    key={period}
                    className="min-w-[5.5rem] px-2 py-2 text-right text-[11px] font-semibold tabular-nums"
                  >
                    {formatPeriodLabel(period, periodMode, locale)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line bg-[#d6e6f5]">
                <td
                  colSpan={matrix.months.length + 1}
                  className="sticky left-0 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#1e4d8c]"
                >
                  {t("personnel.matrix.section.headcount")}
                </td>
              </tr>
              <tr className="border-b border-line bg-white">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-foreground">
                  {t("personnel.matrix.row.headcount")}
                </td>
                {matrix.headcountTotal.map((hc, i) => (
                  <td
                    key={matrix.months[i]}
                    className="px-2 py-2 text-right font-medium tabular-nums text-foreground"
                  >
                    {formatNumber(hc, locale)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-line bg-white">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-foreground">
                  {t("personnel.matrix.row.newHires")}
                </td>
                {matrix.hiredTotal.map((hired, i) => (
                  <td
                    key={`hire-${matrix.months[i]}`}
                    className="px-2 py-2 text-right tabular-nums text-foreground"
                  >
                    {hired > 0 ? `+${formatNumber(hired, locale)}` : "—"}
                  </td>
                ))}
              </tr>

              {matrix.groups.map((group) => (
                <HeadcountGroupRows
                  key={`hc-${group.teamId || "unassigned"}`}
                  group={group}
                  periods={matrix.months}
                  locale={locale}
                />
              ))}

              <tr className="border-b border-line bg-[#d6e6f5]">
                <td
                  colSpan={matrix.months.length + 1}
                  className="sticky left-0 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#1e4d8c]"
                >
                  {t("personnel.matrix.section.costs")}
                </td>
              </tr>

              {matrix.groups.map((group) => (
                <CostGroupRows
                  key={`cost-${group.teamId || "unassigned"}`}
                  group={group}
                  periods={matrix.months}
                  locale={locale}
                />
              ))}

              <tr className="border-t-2 border-line bg-[#e8eef5]">
                <td className="sticky left-0 z-10 bg-[#e8eef5] px-3 py-2.5 text-[12px] font-semibold text-foreground">
                  {t("personnel.matrix.row.totalCost")}
                </td>
                {matrix.costTotal.map((cost, i) => (
                  <td
                    key={matrix.months[i]}
                    className="px-2 py-2.5 text-right text-[12px] font-semibold tabular-nums text-foreground"
                  >
                    {formatEuro(cost, locale)}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-line bg-[#d6e6f5]">
                <td
                  colSpan={matrix.months.length + 1}
                  className="sticky left-0 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#1e4d8c]"
                >
                  {t("personnel.matrix.section.oneTime")}
                </td>
              </tr>

              {matrix.groups.map((group) => (
                <OneTimeGroupRows
                  key={`ot-${group.teamId || "unassigned"}`}
                  group={group}
                  periods={matrix.months}
                  locale={locale}
                />
              ))}

              <tr className="border-t-2 border-line bg-[#e8eef5]">
                <td className="sticky left-0 z-10 bg-[#e8eef5] px-3 py-2.5 text-[12px] font-semibold text-foreground">
                  {t("personnel.matrix.row.totalOneTime")}
                </td>
                {matrix.oneTimeTotal.map((cost, i) => (
                  <td
                    key={`ot-total-${matrix.months[i]}`}
                    className="px-2 py-2.5 text-right text-[12px] font-semibold tabular-nums text-foreground"
                  >
                    {cost > 0 ? formatEuro(cost, locale) : "—"}
                  </td>
                ))}
              </tr>

              <tr className="border-t-2 border-line bg-[#d6e6f5]">
                <td className="sticky left-0 z-10 bg-[#d6e6f5] px-3 py-2.5 text-[13px] font-semibold text-foreground">
                  {t("personnel.matrix.row.grandTotal")}
                </td>
                {matrix.costTotal.map((cost, i) => {
                  const total = cost + (matrix.oneTimeTotal[i] ?? 0);
                  return (
                    <td
                      key={`grand-${matrix.months[i]}`}
                      className="px-2 py-2.5 text-right text-[13px] font-semibold tabular-nums text-foreground"
                    >
                      {formatEuro(total, locale)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HeadcountGroupRows({
  group,
  periods,
  locale,
}: {
  group: PersonnelMatrixTeamGroup;
  periods: string[];
  locale: string;
}) {
  return (
    <Fragment>
      <tr className="border-b border-line bg-[#edf4fb]">
        <td
          colSpan={periods.length + 1}
          className="sticky left-0 px-3 py-1.5 text-[12px] font-semibold text-foreground"
        >
          {group.label}
        </td>
      </tr>
      {group.roles.map((row) => (
        <tr
          key={`hc-${row.role.id}`}
          className="border-b border-line hover:bg-surface-faint"
        >
          <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-foreground">
            {row.role.name}
          </td>
          {row.cells.map((cell, i) => (
            <td
              key={periods[i]}
              className="px-2 py-1.5 text-right tabular-nums text-foreground"
            >
              {cell.headcount > 0 ? formatNumber(cell.headcount, locale) : "—"}
            </td>
          ))}
        </tr>
      ))}
    </Fragment>
  );
}

function CostGroupRows({
  group,
  periods,
  locale,
}: {
  group: PersonnelMatrixTeamGroup;
  periods: string[];
  locale: string;
}) {
  return (
    <Fragment>
      <tr className="border-b border-line bg-[#edf4fb]">
        <td
          colSpan={periods.length + 1}
          className="sticky left-0 px-3 py-1.5 text-[12px] font-semibold text-foreground"
        >
          {group.label}
        </td>
      </tr>
      {group.roles.map((row) => (
        <tr
          key={`cost-${row.role.id}`}
          className="border-b border-line hover:bg-surface-faint"
        >
          <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-foreground">
            {row.role.name}
          </td>
          {row.cells.map((cell, i) => (
            <td
              key={periods[i]}
              className="px-2 py-1.5 text-right tabular-nums text-foreground"
              title={
                cell.headcount > 0
                  ? `${formatNumber(cell.headcount, locale)} FTE`
                  : undefined
              }
            >
              {cell.cost > 0 ? formatEuro(cell.cost, locale) : "—"}
            </td>
          ))}
        </tr>
      ))}
    </Fragment>
  );
}

function OneTimeGroupRows({
  group,
  periods,
  locale,
}: {
  group: PersonnelMatrixTeamGroup;
  periods: string[];
  locale: string;
}) {
  return (
    <Fragment>
      <tr className="border-b border-line bg-[#edf4fb]">
        <td
          colSpan={periods.length + 1}
          className="sticky left-0 px-3 py-1.5 text-[12px] font-semibold text-foreground"
        >
          {group.label}
        </td>
      </tr>
      {group.roles.map((row) => (
        <tr
          key={`ot-${row.role.id}`}
          className="border-b border-line hover:bg-surface-faint"
        >
          <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-foreground">
            {row.role.name}
          </td>
          {row.cells.map((cell, i) => (
            <td
              key={periods[i]}
              className="px-2 py-1.5 text-right tabular-nums text-foreground"
              title={
                cell.hired > 0
                  ? `+${formatNumber(cell.hired, locale)} FTE`
                  : undefined
              }
            >
              {cell.oneTimeCost > 0
                ? formatEuro(cell.oneTimeCost, locale)
                : "—"}
            </td>
          ))}
        </tr>
      ))}
    </Fragment>
  );
}
