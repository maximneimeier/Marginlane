"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import type { OverviewWaterfallStep } from "@/lib/overview";
import { formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] animate-pulse rounded-[10px] bg-surface-soft" />
  ),
});

const WF_LABELS: Record<OverviewWaterfallStep["labelKey"], MessageKey> = {
  revenue: "overviewPage.wf.revenue",
  material: "overviewPage.wf.material",
  db1: "overviewPage.wf.db1",
  logistics: "overviewPage.wf.logistics",
  db2: "overviewPage.wf.db2",
  marketing: "overviewPage.wf.marketing",
  sales: "overviewPage.wf.sales",
  db3: "overviewPage.wf.db3",
};

const COLORS = {
  revenue: "#266df0",
  cost: "#e5484d",
  subtotal: "#1c1d1f",
  marginPos: "#0fc27b",
  marginNeg: "#e5484d",
};

type RangePoint = {
  x: string;
  /** [low, high] — floating range = classic waterfall bar */
  y: [number, number];
  fillColor: string;
  meta: {
    amount: number;
    kind: OverviewWaterfallStep["kind"];
    running: number;
  };
};

function buildRangePoints(
  steps: OverviewWaterfallStep[],
  labelOf: (step: OverviewWaterfallStep) => string,
): RangePoint[] {
  let prevRunning = 0;

  return steps.map((step) => {
    let low: number;
    let high: number;

    if (step.kind === "cost") {
      low = Math.min(prevRunning, step.running);
      high = Math.max(prevRunning, step.running);
    } else {
      low = Math.min(0, step.amount);
      high = Math.max(0, step.amount);
    }

    const fillColor =
      step.kind === "margin"
        ? step.amount >= 0
          ? COLORS.marginPos
          : COLORS.marginNeg
        : step.kind === "revenue"
          ? COLORS.revenue
          : step.kind === "subtotal"
            ? COLORS.subtotal
            : COLORS.cost;

    const point: RangePoint = {
      x: labelOf(step),
      y: [low, high],
      fillColor,
      meta: {
        amount: step.amount,
        kind: step.kind,
        running: step.running,
      },
    };

    prevRunning = step.running;
    return point;
  });
}

function compactEuro(value: number, locale: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) {
    return `${sign}€${(abs / 1_000_000).toLocaleString(locale, {
      maximumFractionDigits: 1,
    })}M`;
  }
  if (abs >= 1_000) {
    return `${sign}€${(abs / 1_000).toLocaleString(locale, {
      maximumFractionDigits: 0,
    })}k`;
  }
  return formatEuro(value, locale);
}

export function OverviewWaterfallChart({
  steps,
}: {
  steps: OverviewWaterfallStep[];
}) {
  const { t, locale } = useI18n();

  const points = useMemo(
    () => buildRangePoints(steps, (step) => t(WF_LABELS[step.labelKey])),
    [steps, t],
  );

  const series = useMemo(
    () => [
      {
        name: t("overviewPage.waterfallTitle"),
        data: points,
      },
    ],
    [points, t],
  );

  const options = useMemo<ApexOptions>(() => {
    return {
      chart: {
        type: "rangeBar",
        toolbar: { show: false },
        fontFamily: "inherit",
        animations: {
          enabled: true,
          speed: 450,
        },
        parentHeightOffset: 0,
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: "52%",
          borderRadius: 5,
          borderRadiusApplication: "around",
          dataLabels: {
            position: "top",
          },
        },
      },
      dataLabels: {
        enabled: true,
        formatter: (_val, opts) => {
          const point = points[opts?.dataPointIndex ?? -1];
          if (!point) return "";
          return compactEuro(point.meta.amount, locale);
        },
        offsetY: -22,
        style: {
          fontSize: "11px",
          fontWeight: 600,
          colors: ["#1c1d1f"],
        },
        background: { enabled: false },
      },
      tooltip: {
        custom: ({ dataPointIndex }) => {
          const point = points[dataPointIndex];
          if (!point) return "";
          const amount = formatEuro(point.meta.amount, locale);
          const running =
            point.meta.kind === "cost"
              ? `<div style="margin-top:2px;color:#9fa1a7;font-size:11px">→ ${compactEuro(point.meta.running, locale)}</div>`
              : "";
          return `<div style="padding:8px 12px;background:#fff;border:1px solid #e4e7ec;border-radius:8px;box-shadow:0 1px 2px rgba(28,29,31,.06)">
            <div style="font-weight:600;font-size:12px;color:#1c1d1f">${point.x}</div>
            <div style="margin-top:2px;font-size:12px;color:#75777c;font-variant-numeric:tabular-nums">${amount}</div>
            ${running}
          </div>`;
        },
      },
      xaxis: {
        type: "category",
        labels: {
          style: {
            colors: "#75777c",
            fontSize: "11px",
          },
          trim: true,
          hideOverlappingLabels: false,
        },
        axisBorder: { color: "#e4e7ec" },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          formatter: (v) => compactEuro(v, locale),
          style: {
            colors: "#75777c",
            fontSize: "11px",
          },
        },
      },
      grid: {
        borderColor: "#e4e7ec",
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        padding: { top: 16, right: 8, left: 4, bottom: 0 },
      },
      legend: { show: false },
      states: {
        hover: {
          filter: { type: "darken" },
        },
      },
    };
  }, [points, locale]);

  return (
    <div className="w-full">
      <div className="w-full min-w-0 [&_.apexcharts-tooltip]:!overflow-visible">
        <ReactApexChart
          type="rangeBar"
          height={340}
          series={series}
          options={options}
        />
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <LegendDot color={COLORS.revenue} label={t("overviewPage.wf.revenue")} />
        <LegendDot color={COLORS.cost} label={t("overviewPage.legend.costs")} />
        <LegendDot
          color={COLORS.subtotal}
          label={t("overviewPage.legend.subtotals")}
        />
        <LegendDot color={COLORS.marginPos} label={t("overviewPage.wf.db3")} />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-2 w-2 rounded-[3px]"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
