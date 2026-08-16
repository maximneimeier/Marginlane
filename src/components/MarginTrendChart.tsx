"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ApexOptions } from "apexcharts";
import type { MarginTrendPoint } from "@/lib/overview";
import { useI18n } from "@/hooks/useI18n";
import { Card } from "@/components/ui";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

export function MarginTrendChart({
  points,
}: {
  points: MarginTrendPoint[];
}) {
  const { t, locale } = useI18n();

  const categories = useMemo(
    () =>
      points.map((p) => {
        const [y, m] = p.month.split("-");
        return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(
          locale,
          { month: "short", year: "2-digit" },
        );
      }),
    [points, locale],
  );

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "line",
        toolbar: { show: false },
        fontFamily: "inherit",
        zoom: { enabled: false },
      },
      stroke: { curve: "smooth", width: 2.5 },
      colors: ["#2f53e8", "#28C7C3"],
      dataLabels: { enabled: false },
      grid: { borderColor: "#e8e8e8", strokeDashArray: 4 },
      xaxis: {
        categories,
        labels: { style: { colors: "#6b7280", fontSize: "11px" } },
      },
      yaxis: [
        {
          title: { text: t("overview.marginTrend.marginAxis") },
          labels: {
            formatter: (v) => `${v.toFixed(0)}%`,
            style: { colors: "#6b7280", fontSize: "11px" },
          },
        },
        {
          opposite: true,
          title: { text: t("overview.marginTrend.revenueAxis") },
          labels: {
            formatter: (v) =>
              new Intl.NumberFormat(locale, {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(v),
            style: { colors: "#6b7280", fontSize: "11px" },
          },
        },
      ],
      legend: { position: "top", horizontalAlign: "left" },
      tooltip: {
        shared: true,
        y: {
          formatter: (v, opts) =>
            (opts?.seriesIndex ?? 0) === 0
              ? `${Number(v).toFixed(1)}%`
              : new Intl.NumberFormat(locale, {
                  style: "currency",
                  currency: "EUR",
                }).format(Number(v)),
        },
      },
    }),
    [categories, locale, t],
  );

  const series = useMemo(
    () => [
      {
        name: t("overview.marginTrend.marginSeries"),
        type: "line",
        data: points.map((p) => Math.round(p.marginPercent * 10) / 10),
      },
      {
        name: t("overview.marginTrend.revenueSeries"),
        type: "column",
        data: points.map((p) => Math.round(p.revenue)),
      },
    ],
    [points, t],
  );

  if (points.length === 0) {
    return (
      <Card>
        <h2 className="mb-2 text-[15px] font-semibold tracking-tight">
          {t("overview.marginTrend.title")}
        </h2>
        <p className="text-[13px] text-muted">{t("overview.marginTrend.empty")}</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
        {t("overview.marginTrend.title")}
      </h2>
      <p className="mb-4 text-[13px] text-muted">
        {t("overview.marginTrend.hint")}
      </p>
      <ReactApexChart
        options={options}
        series={series}
        type="line"
        height={280}
      />
    </Card>
  );
}
