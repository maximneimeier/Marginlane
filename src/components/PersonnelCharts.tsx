"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
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
} from "@/lib/personnel";
import { formatEuro, formatNumber } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { Card } from "@/components/ui";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] animate-pulse rounded-[10px] bg-surface-soft" />
  ),
});

const STACK_COLORS = [
  "#266df0",
  "#0fc27b",
  "#f5a524",
  "#e5484d",
  "#8b5cf6",
  "#06b6d4",
  "#64748b",
  "#ec4899",
  "#84cc16",
  "#f97316",
];

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
  return new Date(y, m - 1, 1).toLocaleDateString(locale, {
    month: "short",
    year: "2-digit",
  });
}

function ChartShell({
  title,
  description,
  empty,
  hasData,
  children,
}: {
  title: string;
  description: string;
  empty: string;
  hasData: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="!p-4 sm:!p-5">
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-0.5 text-[12px] text-muted">{description}</p>
      </div>
      {!hasData ? (
        <div className="flex h-[280px] items-center justify-center rounded-[10px] border border-dashed border-line bg-surface-faint text-[13px] text-muted">
          {empty}
        </div>
      ) : (
        <div className="relative w-full min-w-0 overflow-hidden [&_.apexcharts-canvas]:!mx-auto [&_.apexcharts-tooltip]:!overflow-visible">
          {children}
        </div>
      )}
    </Card>
  );
}

export function PersonnelCharts({ roles, teams, companySettings }: Props) {
  const { t, locale } = useI18n();
  const reactId = useId().replace(/:/g, "");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("year");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

  const matrix = useMemo(() => {
    const monthly = buildPersonnelMonthlyMatrix(
      pricedRoles,
      months,
      teams,
      t("personnel.team.unassigned"),
    );
    return periodMode === "year"
      ? aggregatePersonnelMatrixByYear(monthly)
      : monthly;
  }, [pricedRoles, months, teams, t, periodMode]);

  const categories = useMemo(
    () =>
      matrix.months.map((key) => formatPeriodLabel(key, periodMode, locale)),
    [matrix.months, periodMode, locale],
  );

  const headcountSeries = useMemo(
    () =>
      matrix.groups
        .map((g) => ({ name: g.label, data: g.headcountByMonth }))
        .filter((s) => s.data.some((v) => v > 0)),
    [matrix.groups],
  );

  const costSeries = useMemo(
    () =>
      matrix.groups
        .map((g) => ({ name: g.label, data: g.costByMonth }))
        .filter((s) => s.data.some((v) => v > 0)),
    [matrix.groups],
  );

  const donut = useMemo(() => {
    const labels: string[] = [];
    const series: number[] = [];
    for (const g of matrix.groups) {
      const sum = g.costByMonth.reduce((s, v) => s + v, 0);
      if (sum <= 0) continue;
      labels.push(g.label);
      series.push(Math.round(sum * 100) / 100);
    }
    return { labels, series };
  }, [matrix.groups]);

  const hasHeadcount = headcountSeries.length > 0;
  const hasCost = costSeries.length > 0;
  const hasDonut = donut.series.length > 0;

  const headcountOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        id: `personnel-hc-${reactId}`,
        type: "bar",
        stacked: true,
        toolbar: { show: false },
        fontFamily: "inherit",
        animations: { enabled: false },
        redrawOnParentResize: true,
        redrawOnWindowResize: true,
      },
      colors: STACK_COLORS,
      plotOptions: {
        bar: {
          columnWidth: categories.length > 8 ? "70%" : "55%",
          borderRadius: 3,
          borderRadiusApplication: "end",
          borderRadiusWhenStacked: "last",
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      xaxis: {
        categories,
        labels: {
          style: { colors: "#8b8d92", fontSize: "11px" },
          rotate: categories.length > 10 ? -45 : 0,
          rotateAlways: categories.length > 10,
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: { colors: "#8b8d92", fontSize: "11px" },
          formatter: (v) => formatNumber(v, locale),
        },
      },
      grid: {
        borderColor: "#ececec",
        strokeDashArray: 3,
        xaxis: { lines: { show: false } },
      },
      legend: {
        position: "bottom",
        fontSize: "12px",
        markers: { size: 8, shape: "circle" },
        itemMargin: { horizontal: 10, vertical: 4 },
      },
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: (v) => `${formatNumber(v ?? 0, locale)} FTE`,
        },
      },
      fill: { opacity: 1 },
    }),
    [categories, locale, reactId],
  );

  const costOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        id: `personnel-cost-${reactId}`,
        type: "bar",
        stacked: true,
        toolbar: { show: false },
        fontFamily: "inherit",
        animations: { enabled: false },
        redrawOnParentResize: true,
        redrawOnWindowResize: true,
      },
      colors: STACK_COLORS,
      plotOptions: {
        bar: {
          columnWidth: categories.length > 8 ? "70%" : "55%",
          borderRadius: 3,
          borderRadiusApplication: "end",
          borderRadiusWhenStacked: "last",
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      xaxis: {
        categories,
        labels: {
          style: { colors: "#8b8d92", fontSize: "11px" },
          rotate: categories.length > 10 ? -45 : 0,
          rotateAlways: categories.length > 10,
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: { colors: "#8b8d92", fontSize: "11px" },
          formatter: (v) => formatEuro(v, locale),
        },
      },
      grid: {
        borderColor: "#ececec",
        strokeDashArray: 3,
        xaxis: { lines: { show: false } },
      },
      legend: {
        position: "bottom",
        fontSize: "12px",
        markers: { size: 8, shape: "circle" },
        itemMargin: { horizontal: 10, vertical: 4 },
      },
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: (v) => formatEuro(v ?? 0, locale),
        },
      },
      fill: { opacity: 1 },
    }),
    [categories, locale, reactId],
  );

  const donutOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        id: `personnel-donut-${reactId}`,
        type: "donut",
        fontFamily: "inherit",
        animations: { enabled: false },
      },
      colors: STACK_COLORS,
      labels: donut.labels,
      legend: {
        position: "bottom",
        fontSize: "12px",
        markers: { size: 8, shape: "circle" },
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => `${Math.round(Number(val))}%`,
      },
      plotOptions: {
        pie: {
          donut: {
            size: "62%",
            labels: {
              show: true,
              total: {
                show: true,
                label: t("personnel.charts.donutTotal"),
                formatter: (w) => {
                  const sum = (
                    w.globals.seriesTotals as number[]
                  ).reduce((s, v) => s + v, 0);
                  return formatEuro(sum, locale);
                },
              },
            },
          },
        },
      },
      tooltip: {
        y: {
          formatter: (v) => formatEuro(v ?? 0, locale),
        },
      },
    }),
    [donut.labels, locale, reactId, t],
  );

  const chartKey = useMemo(
    () =>
      [
        periodMode,
        matrix.months.join(","),
        ...headcountSeries.map((s) => `${s.name}:${s.data.join(",")}`),
        ...costSeries.map((s) => `${s.name}:${s.data.join(",")}`),
        donut.series.join(","),
      ].join("|"),
    [periodMode, matrix.months, headcountSeries, costSeries, donut.series],
  );

  if (roles.length === 0 || months.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-line px-4 py-12 text-center text-[13px] text-muted">
        {t("personnel.charts.empty")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
            {t("personnel.charts.title")}
          </h3>
          <p className="mt-0.5 text-[12px] text-muted">
            {t("personnel.charts.hint")}
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

      <div className="grid gap-4">
        <ChartShell
          title={t("personnel.charts.headcountTitle")}
          description={t("personnel.charts.headcountHint")}
          empty={t("personnel.charts.empty")}
          hasData={hasHeadcount}
        >
          {mounted ? (
            <ReactApexChart
              key={`hc-${chartKey}`}
              type="bar"
              height={320}
              series={headcountSeries}
              options={headcountOptions}
            />
          ) : (
            <div className="h-[320px] animate-pulse rounded-[10px] bg-surface-soft" />
          )}
        </ChartShell>

        <ChartShell
          title={t("personnel.charts.costTitle")}
          description={t("personnel.charts.costHint")}
          empty={t("personnel.charts.empty")}
          hasData={hasCost}
        >
          {mounted ? (
            <ReactApexChart
              key={`cost-${chartKey}`}
              type="bar"
              height={320}
              series={costSeries}
              options={costOptions}
            />
          ) : (
            <div className="h-[320px] animate-pulse rounded-[10px] bg-surface-soft" />
          )}
        </ChartShell>

        <ChartShell
          title={t("personnel.charts.donutTitle")}
          description={t("personnel.charts.donutHint")}
          empty={t("personnel.charts.empty")}
          hasData={hasDonut}
        >
          {mounted ? (
            <ReactApexChart
              key={`donut-${chartKey}`}
              type="donut"
              height={320}
              series={donut.series}
              options={donutOptions}
            />
          ) : (
            <div className="h-[320px] animate-pulse rounded-[10px] bg-surface-soft" />
          )}
        </ChartShell>
      </div>
    </div>
  );
}
