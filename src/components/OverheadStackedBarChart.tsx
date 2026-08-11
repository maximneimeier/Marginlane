"use client";

import { useEffect, useId, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import type { OverheadItem, AppData } from "@/lib/types";
import type { DateRange } from "@/lib/overview";
import {
  buildOverheadTimeline,
  type OverheadTimelineGranularity,
} from "@/lib/overhead";
import { formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";
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

const GRANULARITY_HINT: Record<OverheadTimelineGranularity, MessageKey> = {
  month: "overhead.chart.granularity.month",
  quarter: "overhead.chart.granularity.quarter",
  year: "overhead.chart.granularity.year",
};

type Props = {
  items: OverheadItem[];
  range: DateRange;
  data?: AppData | null;
};

export function OverheadStackedBarChart({ items, range, data = null }: Props) {
  const { t, locale } = useI18n();
  const reactId = useId().replace(/:/g, "");
  /** Verhindert doppelte Apex-Instanzen (Strict Mode / Option-Updates). */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const timeline = useMemo(
    () => buildOverheadTimeline(items, range, locale, data),
    [items, range, locale, data],
  );

  const hasData =
    timeline.categories.length > 0 &&
    timeline.series.some((s) => s.data.some((v) => v > 0));

  const series = useMemo(
    () =>
      timeline.series
        .filter((s) => s.data.some((v) => v > 0))
        .map((s) => ({ name: s.name, data: s.data })),
    [timeline.series],
  );

  const chartKey = useMemo(
    () =>
      [
        range.from,
        range.to,
        timeline.granularity,
        timeline.categories.join(","),
        ...series.map((s) => `${s.name}:${s.data.join(",")}`),
      ].join("|"),
    [range.from, range.to, timeline.granularity, timeline.categories, series],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        id: `overhead-stack-${reactId}`,
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
          columnWidth: timeline.categories.length > 8 ? "70%" : "55%",
          borderRadius: 3,
          borderRadiusApplication: "end",
          borderRadiusWhenStacked: "last",
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      xaxis: {
        categories: timeline.categories,
        labels: {
          style: { colors: "#8b8d92", fontSize: "11px" },
          rotate: timeline.categories.length > 10 ? -45 : 0,
          rotateAlways: timeline.categories.length > 10,
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
    [timeline.categories, locale, reactId],
  );

  return (
    <Card className="!p-4 sm:!p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
            {t("overhead.chart.title")}
          </h3>
          <p className="mt-0.5 text-[12px] text-muted">
            {t("overhead.chart.description")} ·{" "}
            {t(GRANULARITY_HINT[timeline.granularity])}
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="flex h-[280px] items-center justify-center rounded-[10px] border border-dashed border-line bg-surface-faint text-[13px] text-muted">
          {t("overhead.chart.empty")}
        </div>
      ) : (
        <div className="relative w-full min-w-0 overflow-hidden [&_.apexcharts-canvas]:!mx-auto [&_.apexcharts-tooltip]:!overflow-visible">
          {mounted ? (
            <ReactApexChart
              key={chartKey}
              type="bar"
              height={320}
              series={series}
              options={options}
            />
          ) : (
            <div className="h-[320px] animate-pulse rounded-[10px] bg-surface-soft" />
          )}
        </div>
      )}
    </Card>
  );
}
