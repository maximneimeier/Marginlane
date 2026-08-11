"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";
import type { AppData } from "@/lib/types";
import type { DateRange } from "@/lib/overview";
import { buildOverheadWaterfall } from "@/lib/overhead";
import { formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";
import { Card } from "@/components/ui";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] animate-pulse rounded-[10px] bg-surface-soft" />
  ),
});

type Props = {
  data: AppData;
  range: DateRange;
};

export function OverheadResultWaterfallChart({ data, range }: Props) {
  const { t, locale } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const waterfall = useMemo(
    () =>
      buildOverheadWaterfall(data, range, (kategorie) =>
        t(`overhead.category.${kategorie}` as MessageKey),
      ),
    [data, range, t],
  );

  const labels = useMemo(() => {
    return waterfall.steps.map((s) => {
      if (s.id === "db3") return t("overhead.chart.waterfall.db3");
      if (s.id === "result") return t("overhead.chart.waterfall.result");
      if (s.id === "overhead") return t("overhead.chart.waterfall.overhead");
      return s.label;
    });
  }, [waterfall.steps, t]);

  const hasData =
    waterfall.steps.length > 0 &&
    (Math.abs(waterfall.db3) > 0.005 || waterfall.totalOverhead > 0.005);

  const chartKey = useMemo(
    () =>
      [
        range.from,
        range.to,
        ...waterfall.steps.map((s) => `${s.id}:${s.base}:${s.amount}`),
      ].join("|"),
    [range.from, range.to, waterfall.steps],
  );

  const option = useMemo<EChartsOption>(() => {
    const baseData = waterfall.steps.map((s) =>
      Math.round(s.base * 100) / 100,
    );
    const valueData = waterfall.steps.map((s) => {
      return {
        value: Math.round(s.amount * 100) / 100,
        itemStyle: {
          color:
            s.kind === "decrease"
              ? "#e5484d"
              : s.kind === "result"
                ? waterfall.operatingResult >= 0
                  ? "#0fc27b"
                  : "#e5484d"
                : "#266df0",
        },
        kind: s.kind,
      };
    });

    return {
      animation: false,
      grid: {
        left: 16,
        right: 16,
        top: 28,
        bottom: 8,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const list = Array.isArray(params) ? params : [params];
          const valueItem = list.find(
            (p) =>
              (p as { seriesName?: string }).seriesName ===
              t("overhead.chart.waterfall.series"),
          ) as
            | {
                name?: string;
                data?: { value?: number; signed?: number; kind?: string };
              }
            | undefined;
          if (!valueItem?.data) return "";
          const amount = valueItem.data.value ?? 0;
          const kind = valueItem.data.kind;
          const prefix =
            kind === "decrease" ? "−" : kind === "result" ? "=" : "";
          return `${valueItem.name}<br/><b>${prefix}${formatEuro(amount, locale)}</b>`;
        },
      },
      xAxis: {
        type: "category",
        data: labels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#e5e7eb" } },
        axisLabel: {
          color: "#6b7280",
          fontSize: 11,
          interval: 0,
          hideOverlap: true,
          formatter: (value: string) => {
            if (value.length <= 14) return value;
            return `${value.slice(0, 12)}…`;
          },
        },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: "#9ca3af",
          fontSize: 11,
          formatter: (v: number) => formatEuro(v, locale),
        },
        splitLine: { lineStyle: { color: "#f3f4f6" } },
      },
      series: [
        {
          name: "base",
          type: "bar",
          stack: "waterfall",
          silent: true,
          itemStyle: {
            borderColor: "transparent",
            color: "transparent",
          },
          emphasis: { itemStyle: { color: "transparent" } },
          data: baseData,
        },
        {
          name: t("overhead.chart.waterfall.series"),
          type: "bar",
          stack: "waterfall",
          barMaxWidth: 56,
          label: {
            show: true,
            position: "top",
            color: "#1c1d1f",
            fontSize: 11,
            formatter: (params: unknown) => {
              const p = params as {
                data?: { value?: number; kind?: string };
              };
              const v = p.data?.value ?? 0;
              if (v < 0.005) return "";
              const kind = p.data?.kind;
              const prefix = kind === "decrease" ? "−" : "";
              return `${prefix}${formatEuro(v, locale)}`;
            },
          },
          data: valueData,
        },
      ],
    };
  }, [waterfall, labels, locale, t]);

  return (
    <Card className="!p-4 sm:!p-5">
      <div className="mb-3">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">
          {t("overhead.chart.waterfall.title")}
        </h3>
        <p className="mt-0.5 text-[12px] text-muted">
          {t("overhead.chart.waterfall.description")}
        </p>
      </div>
      {!hasData ? (
        <div className="flex h-[240px] items-center justify-center rounded-[10px] border border-dashed border-line bg-surface-faint text-[13px] text-muted">
          {t("overhead.chart.waterfall.empty")}
        </div>
      ) : (
        <div className="relative w-full min-w-0 overflow-hidden">
          {mounted ? (
            <ReactECharts
              key={chartKey}
              option={option}
              style={{ height: 320, width: "100%" }}
              opts={{ renderer: "svg" }}
              notMerge
              lazyUpdate
            />
          ) : (
            <div className="h-[320px] animate-pulse rounded-[10px] bg-surface-soft" />
          )}
        </div>
      )}
    </Card>
  );
}
