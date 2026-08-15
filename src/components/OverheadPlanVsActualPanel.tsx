"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import { usePrefs } from "@/context/PreferencesContext";
import type { DateRange } from "@/lib/overview";
import {
  buildPlanVsActual,
  buildPlanVsActualPositions,
  effectivePlanOverheadItems,
  emptyOverheadActual,
  type PlanVsActualPositionRow,
} from "@/lib/overhead";
import { formatEuro, formatPercent } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { useI18n } from "@/hooks/useI18n";
import { Badge, Card, Field, Select, TextInput } from "@/components/ui";

type Props = {
  range: DateRange;
};

export function OverheadPlanVsActualPanel({ range }: Props) {
  const { data, upsertOverheadActual, deleteOverheadActual } = useStore();
  const { prefs } = usePrefs();
  const { t, locale } = useI18n();

  const report = useMemo(
    () =>
      buildPlanVsActual(
        effectivePlanOverheadItems(data),
        data.overheadActuals ?? [],
        range,
        data,
      ),
    [data, range],
  );

  const months = report.months;
  const fallbackMonth = currentMonthKey();
  const [selectedMonth, setSelectedMonth] = useState<string>(
    () =>
      months.find((m) => m === currentMonthKey()) ??
      months[months.length - 1] ??
      fallbackMonth,
  );

  const activeMonth = months.includes(selectedMonth)
    ? selectedMonth
    : (months.find((m) => m === currentMonthKey()) ??
      months[months.length - 1] ??
      selectedMonth);

  const positions = useMemo(
    () =>
      buildPlanVsActualPositions(
        effectivePlanOverheadItems(data),
        data.overheadActuals ?? [],
        activeMonth,
        data,
      ),
    [data, activeMonth],
  );

  const monthPlan = positions.reduce((acc, r) => acc + r.plan, 0);
  const monthActual = positions.reduce((acc, r) => acc + r.actual, 0);
  const monthDelta = monthActual - monthPlan;

  const deltaTone = (delta: number) =>
    delta > 0 ? "text-danger" : delta < 0 ? "text-success" : "text-muted";

  function formatDelta(delta: number, percent: number | null) {
    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
    const abs = formatEuro(Math.abs(delta), locale);
    const pct =
      percent == null
        ? ""
        : ` (${percent >= 0 ? "+" : "−"}${formatPercent(Math.abs(percent), locale)})`;
    return `${sign}${abs}${pct}`;
  }

  function formatMonthLabel(month: string) {
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return month;
    return new Date(y, m - 1, 1).toLocaleDateString(locale, {
      month: "long",
      year: "numeric",
    });
  }

  function commitRowActual(row: PlanVsActualPositionRow, betrag: number) {
    const rounded = Math.round(betrag * 100) / 100;
    const actor = prefs.displayName?.trim() || null;
    if (row.actuals.length === 0) {
      if (rounded <= 0) return;
      upsertOverheadActual({
        ...emptyOverheadActual(activeMonth, row.kategorie, row.planItemId),
        name: row.name,
        betrag: rounded,
        updatedBy: actor,
      });
      return;
    }
    if (rounded <= 0) {
      for (const a of row.actuals) deleteOverheadActual(a.id);
      return;
    }
    const [first, ...rest] = row.actuals;
    upsertOverheadActual({ ...first!, betrag: rounded, updatedBy: actor });
    for (const a of rest) deleteOverheadActual(a.id);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label={t("overhead.planVsActual.plan")}
          value={formatEuro(report.planTotal, locale)}
        />
        <SummaryTile
          label={t("overhead.planVsActual.actual")}
          value={formatEuro(report.actualTotal, locale)}
        />
        <SummaryTile
          label={t("overhead.planVsActual.delta")}
          value={formatDelta(report.delta, report.deltaPercent)}
          valueClassName={deltaTone(report.delta)}
        />
      </div>

      {report.planTotal === 0 && !report.hasActuals ? (
        <div className="rounded-[12px] border border-dashed border-line px-4 py-10 text-center">
          <p className="text-[14px] font-medium text-foreground">
            {t("overhead.planVsActual.emptyTitle")}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">
            {t("overhead.planVsActual.emptyDescription")}
          </p>
        </div>
      ) : (
        <>
          <Card className="!p-0 overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <h4 className="text-[13px] font-semibold text-foreground">
                {t("overhead.planVsActual.byCategory")}
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                    <th className="px-4 py-2.5 font-medium">
                      {t("overhead.col.kategorie")}
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      {t("overhead.planVsActual.plan")}
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      {t("overhead.planVsActual.actual")}
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      {t("overhead.planVsActual.delta")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.byCategory.map((row) => (
                    <tr
                      key={row.kategorie}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-4 py-2.5 font-medium">
                        {t(
                          `overhead.category.${row.kategorie}` as MessageKey,
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                        {formatEuro(row.plan, locale)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {formatEuro(row.actual, locale)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right tabular-nums font-medium ${deltaTone(row.delta)}`}
                      >
                        {formatDelta(row.delta, row.deltaPercent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line bg-surface-faint">
                    <td className="px-4 py-2.5 text-[13px] font-semibold">
                      {t("overhead.planVsActual.total")}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums">
                      {formatEuro(report.planTotal, locale)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums">
                      {formatEuro(report.actualTotal, locale)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right text-[13px] font-semibold tabular-nums ${deltaTone(report.delta)}`}
                    >
                      {formatDelta(report.delta, report.deltaPercent)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card className="!p-0 overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <h4 className="text-[13px] font-semibold text-foreground">
                  {t("overhead.planVsActual.compareTitle")}
                </h4>
                <p className="mt-0.5 text-[12px] text-muted">
                  {t("overhead.planVsActual.compareHint")}
                </p>
              </div>
              <Field label={t("overhead.planVsActual.month")}>
                <Select
                  value={activeMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="!w-[200px]"
                >
                  {(months.length > 0 ? months : [activeMonth]).map((m) => (
                    <option key={m} value={m}>
                      {formatMonthLabel(m)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {months.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                {t("overhead.planVsActual.noMonths")}
              </p>
            ) : positions.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                {t("overhead.planVsActual.noPositions")}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line bg-surface-faint px-4 py-2.5 text-[12px]">
                  <span className="font-semibold text-foreground">
                    {formatMonthLabel(activeMonth)}
                  </span>
                  <span className="text-muted">
                    {t("overhead.planVsActual.plan")}:{" "}
                    <span className="tabular-nums text-foreground">
                      {formatEuro(monthPlan, locale)}
                    </span>
                    {" · "}
                    {t("overhead.planVsActual.actual")}:{" "}
                    <span className="tabular-nums font-medium text-foreground">
                      {formatEuro(monthActual, locale)}
                    </span>
                    {" · "}
                    <span
                      className={`tabular-nums font-medium ${deltaTone(monthDelta)}`}
                    >
                      {formatDelta(monthDelta, null)}
                    </span>
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                        <th className="px-4 py-2.5 font-medium">
                          {t("overhead.planVsActual.col.position")}
                        </th>
                        <th className="px-4 py-2.5 font-medium">
                          {t("overhead.col.kategorie")}
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          {t("overhead.planVsActual.plan")}
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          {t("overhead.planVsActual.actual")}
                        </th>
                        <th className="px-4 py-2.5 text-right font-medium">
                          {t("overhead.planVsActual.delta")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((row) => (
                        <tr
                          key={`${row.planItemId ?? "ist"}:${row.name}:${row.kategorie}`}
                          className="border-b border-line last:border-0 hover:bg-surface-faint"
                        >
                          <td className="px-4 py-3 font-medium text-foreground">
                            {row.name}
                            {!row.planItemId ? (
                              <span className="mt-0.5 block text-[11px] font-normal text-muted-soft">
                                {t("overhead.planVsActual.noPlanLink")}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              tone={
                                row.kategorie === "vertriebsgemeinkosten"
                                  ? "accent"
                                  : row.kategorie === "fertigungsgemeinkosten"
                                    ? "success"
                                    : "neutral"
                              }
                            >
                              {t(
                                `overhead.category.${row.kategorie}` as MessageKey,
                              )}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted">
                            {row.plan > 0 ? formatEuro(row.plan, locale) : "—"}
                          </td>
                          <td className="px-2 py-2.5">
                            <InlineIstAmount
                              value={row.actual}
                              planHint={row.plan}
                              locale={locale}
                              ariaLabel={t("overhead.planVsActual.actual")}
                              onCommit={(betrag) =>
                                commitRowActual(row, betrag)
                              }
                            />
                          </td>
                          <td
                            className={`px-4 py-3 text-right tabular-nums font-medium ${
                              row.plan > 0 || row.actual > 0
                                ? deltaTone(row.delta)
                                : "text-muted"
                            }`}
                          >
                            {row.plan > 0 || row.actual > 0
                              ? formatDelta(row.delta, null)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-line bg-surface-faint">
                        <td
                          colSpan={2}
                          className="px-4 py-3 text-[13px] font-semibold"
                        >
                          {t("overhead.planVsActual.total")}
                        </td>
                        <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums">
                          {formatEuro(monthPlan, locale)}
                        </td>
                        <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums">
                          {formatEuro(monthActual, locale)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-[13px] font-semibold tabular-nums ${deltaTone(monthDelta)}`}
                        >
                          {formatDelta(monthDelta, null)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function InlineIstAmount({
  value,
  planHint,
  locale,
  ariaLabel,
  onCommit,
}: {
  value: number;
  planHint: number;
  locale: string;
  ariaLabel: string;
  onCommit: (betrag: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display =
    draft ??
    (value === 0
      ? ""
      : value.toLocaleString(locale, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }));

  function commit(raw: string) {
    const normalized = raw.replace(/\s/g, "").replace(",", ".");
    if (normalized === "") {
      onCommit(0);
      setDraft(null);
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDraft(null);
      return;
    }
    onCommit(Math.round(parsed * 100) / 100);
    setDraft(null);
  }

  return (
    <TextInput
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={
        planHint > 0
          ? planHint.toLocaleString(locale, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })
          : "0"
      }
      value={display}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
      className="!min-w-[6.5rem] !px-2 !py-1.5 text-right tabular-nums"
    />
  );
}

function SummaryTile({
  label,
  value,
  valueClassName = "text-foreground",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[12px] border border-line bg-white px-4 py-3 shadow-[var(--shadow-sm)]">
      <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
        {label}
      </p>
      <p
        className={`mt-1 text-[18px] font-semibold tabular-nums tracking-tight ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}
