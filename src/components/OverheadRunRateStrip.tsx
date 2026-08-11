"use client";

import { useMemo } from "react";
import type { OverheadItem, AppData } from "@/lib/types";
import type { DateRange } from "@/lib/overview";
import {
  buildOverheadRunRate,
  type OverheadPeriodCompare,
} from "@/lib/overhead";
import { formatEuro, formatPercent } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { useI18n } from "@/hooks/useI18n";

type Props = {
  items: OverheadItem[];
  range: DateRange;
  data?: AppData | null;
};

export function OverheadRunRateStrip({ items, range, data = null }: Props) {
  const { t, locale } = useI18n();
  const run = useMemo(
    () => buildOverheadRunRate(items, range, data),
    [items, range, data],
  );

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[12px]">
        <Metric
          label={t("overhead.runRate.monthly")}
          value={formatEuro(run.monthlyRunRate, locale)}
        />
        <Metric
          label={t("overhead.runRate.annualized")}
          value={formatEuro(run.annualized, locale)}
        />
        <Metric
          label={t("overhead.runRate.period")}
          value={formatEuro(run.periodTotal, locale)}
        />
      </div>

      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[12px]">
        <CompareMetric
          label={t("overhead.runRate.vsPrevious")}
          compare={
            run.deltaVsPrevious == null
              ? null
              : {
                  range: range,
                  total: run.previousPeriodTotal ?? 0,
                  delta: run.deltaVsPrevious,
                  deltaPercent: run.deltaPercentVsPrevious,
                }
          }
          locale={locale}
          empty={t("common.emDash")}
        />
        <CompareMetric
          label={t("overhead.runRate.vsYoy")}
          compare={run.vsYearAgo}
          locale={locale}
          empty={t("common.emDash")}
        />
        <CompareMetric
          label={t("overhead.runRate.vsQuarterYoy")}
          compare={run.vsQuarterLastYear}
          locale={locale}
          empty={t("common.emDash")}
        />
      </div>

      {run.byCategoryVsPrevious.length > 0 ? (
        <div className="overflow-hidden rounded-[10px] border border-line">
          <div className="border-b border-line bg-surface-faint px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
              {t("overhead.runRate.categoryTrend")}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {t("overhead.runRate.categoryTrendHint")}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-line text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                  <th className="px-3 py-2 font-medium">
                    {t("overhead.col.kategorie")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("overhead.runRate.period")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("overhead.runRate.priorPeriod")}
                  </th>
                  <th className="px-3 py-2 text-right font-medium">
                    {t("overhead.runRate.delta")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {run.byCategoryVsPrevious.map((row) => (
                  <tr
                    key={row.kategorie}
                    className="border-b border-line last:border-0"
                  >
                    <td className="px-3 py-2 font-medium text-foreground">
                      {t(`overhead.category.${row.kategorie}` as MessageKey)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEuro(row.current, locale)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {formatEuro(row.previous, locale)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums font-medium ${deltaTone(row.delta)}`}
                    >
                      {formatDelta(row.delta, row.deltaPercent, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function deltaTone(delta: number | null) {
  if (delta == null) return "text-muted";
  if (delta > 0) return "text-danger";
  if (delta < 0) return "text-success";
  return "text-muted";
}

function formatDelta(
  delta: number,
  percent: number | null | undefined,
  locale: string,
) {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const abs = formatEuro(Math.abs(delta), locale);
  const pct =
    percent == null
      ? ""
      : ` (${percent >= 0 ? "+" : "−"}${formatPercent(Math.abs(percent), locale)})`;
  return `${sign}${abs}${pct}`;
}

function CompareMetric({
  label,
  compare,
  locale,
  empty,
}: {
  label: string;
  compare: OverheadPeriodCompare | null;
  locale: string;
  empty: string;
}) {
  if (!compare) {
    return (
      <div className="min-w-0">
        <span className="text-muted-soft">{label}</span>{" "}
        <span className="font-medium tabular-nums text-muted">{empty}</span>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <span className="text-muted-soft">{label}</span>{" "}
      <span className={`font-medium tabular-nums ${deltaTone(compare.delta)}`}>
        {formatDelta(compare.delta, compare.deltaPercent, locale)}
      </span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-muted-soft">{label}</span>{" "}
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}
