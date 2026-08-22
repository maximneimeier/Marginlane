"use client";

import { useEffect, useId, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import type { AppData } from "@/lib/types";
import {
  buildInventoryOverview,
  buildInventoryStockTrend,
  type InventoryStockScope,
} from "@/lib/inventoryOverview";
import { formatDate, formatEuro, formatNumber } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { Card, Select } from "@/components/ui";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] animate-pulse rounded-[10px] bg-surface-soft" />
  ),
});

const COLORS = {
  accent: "#266df0",
  success: "#0fc27b",
  warn: "#f5a524",
  muted: "#94a3b8",
};

type Props = {
  data: AppData;
  scope: InventoryStockScope;
};

export function InventoryOverviewPanel({ data, scope }: Props) {
  const { t, locale } = useI18n();
  const reactId = useId().replace(/:/g, "");
  const [mounted, setMounted] = useState(false);
  const [trendComponentId, setTrendComponentId] = useState("");
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    setTrendComponentId("");
  }, [scope]);

  const overview = useMemo(
    () => buildInventoryOverview(data, undefined, scope),
    [data, scope],
  );
  const {
    kpis,
    productBars,
    componentBars,
    pipelineMix,
    fidelity,
    stockTrendComponents,
  } = overview;

  const stockTrend = useMemo(
    () =>
      buildInventoryStockTrend(
        data,
        scope === "parts" && trendComponentId ? trendComponentId : null,
        undefined,
        scope,
      ),
    [data, trendComponentId, scope],
  );

  const productChart = useMemo(() => {
    const categories = productBars.map((r) => r.name);
    const values = productBars.map((r) => Math.round(r.stockValue * 100) / 100);
    const options: ApexOptions = {
      chart: {
        id: `inv-product-${reactId}`,
        type: "bar",
        toolbar: { show: false },
        fontFamily: "inherit",
        animations: { enabled: false },
      },
      plotOptions: {
        bar: { horizontal: true, borderRadius: 4, barHeight: "70%" },
      },
      colors: [COLORS.accent],
      dataLabels: { enabled: false },
      xaxis: {
        categories,
        labels: {
          formatter: (v) => formatEuro(Number(v), locale),
          style: { colors: COLORS.muted, fontSize: "11px" },
        },
      },
      yaxis: {
        labels: { style: { colors: "#1c1d1f", fontSize: "12px" } },
      },
      grid: { borderColor: "#e8eaed", strokeDashArray: 3 },
      tooltip: {
        y: { formatter: (v) => formatEuro(Number(v), locale) },
      },
    };
    return {
      options,
      series: [{ name: t("inventory.overview.chart.stockValue"), data: values }],
      hasData: values.some((v) => v > 0),
    };
  }, [productBars, locale, reactId, t]);

  const componentChart = useMemo(() => {
    const categories = componentBars.map((r) => r.name);
    const free = componentBars.map((r) => Math.round(r.free * 100) / 100);
    const reserved = componentBars.map(
      (r) => Math.round(Math.min(r.reserved, r.onHand) * 100) / 100,
    );
    const options: ApexOptions = {
      chart: {
        id: `inv-parts-${reactId}`,
        type: "bar",
        stacked: true,
        toolbar: { show: false },
        fontFamily: "inherit",
        animations: { enabled: false },
      },
      plotOptions: {
        bar: { horizontal: true, borderRadius: 4, barHeight: "70%" },
      },
      colors: [COLORS.success, COLORS.warn],
      dataLabels: { enabled: false },
      xaxis: {
        categories,
        labels: {
          formatter: (v) => formatNumber(Number(v), locale),
          style: { colors: COLORS.muted, fontSize: "11px" },
        },
      },
      yaxis: {
        labels: { style: { colors: "#1c1d1f", fontSize: "12px" } },
      },
      legend: { position: "bottom", fontSize: "12px" },
      grid: { borderColor: "#e8eaed", strokeDashArray: 3 },
      tooltip: {
        y: {
          formatter: (v) => formatNumber(Number(v), locale),
        },
      },
    };
    return {
      options,
      series: [
        { name: t("inventory.overview.chart.partsFree"), data: free },
        { name: t("inventory.overview.chart.partsReserved"), data: reserved },
      ],
      hasData: componentBars.some((r) => r.onHand > 0 || r.reserved > 0),
    };
  }, [componentBars, locale, reactId, t]);

  const mixChart = useMemo(() => {
    const labels = [
      t("batches.pipeline.ordered"),
      t("batches.pipeline.in_transit"),
      t("batches.pipeline.arrived"),
    ];
    const values = [
      Math.round(pipelineMix.ordered * 100) / 100,
      Math.round(pipelineMix.in_transit * 100) / 100,
      Math.round(pipelineMix.arrived * 100) / 100,
    ];
    const options: ApexOptions = {
      chart: {
        id: `inv-mix-${reactId}`,
        type: "donut",
        toolbar: { show: false },
        fontFamily: "inherit",
        animations: { enabled: false },
      },
      labels,
      colors: [COLORS.muted, COLORS.accent, COLORS.success],
      legend: { position: "bottom", fontSize: "12px" },
      dataLabels: { enabled: false },
      tooltip: {
        y: { formatter: (v) => formatEuro(Number(v), locale) },
      },
      plotOptions: {
        pie: {
          donut: {
            size: "62%",
            labels: {
              show: true,
              total: {
                show: true,
                label: t("inventory.overview.chart.mixTotal"),
                formatter: () =>
                  formatEuro(
                    values.reduce((a, b) => a + b, 0),
                    locale,
                  ),
              },
            },
          },
        },
      },
    };
    return {
      options,
      series: values,
      hasData: values.some((v) => v > 0),
    };
  }, [pipelineMix, locale, reactId, t]);

  const trendChart = useMemo(() => {
    const categories = stockTrend.map((p) => formatDate(p.date, locale));
    const values = stockTrend.map((p) => Math.round(p.value * 100) / 100);
    const options: ApexOptions = {
      chart: {
        id: `inv-trend-${reactId}`,
        type: "area",
        toolbar: { show: false },
        fontFamily: "inherit",
        animations: { enabled: false },
      },
      colors: [COLORS.accent],
      stroke: { curve: "smooth", width: 2 },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 0.35,
          opacityFrom: 0.35,
          opacityTo: 0.02,
        },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories,
        labels: { style: { colors: COLORS.muted, fontSize: "11px" } },
      },
      yaxis: {
        labels: {
          formatter: (v) => formatEuro(Number(v), locale),
          style: { colors: COLORS.muted, fontSize: "11px" },
        },
      },
      grid: { borderColor: "#e8eaed", strokeDashArray: 3 },
      tooltip: {
        y: { formatter: (v) => formatEuro(Number(v), locale) },
      },
    };
    return {
      options,
      series: [
        { name: t("inventory.overview.chart.stockTrend"), data: values },
      ],
      hasData: values.length > 1,
    };
  }, [stockTrend, locale, reactId, t]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="!p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
            {t("inventory.overview.kpi.stockValue")}
          </p>
          <p className="mt-1 text-lg tabular-nums font-semibold">
            {formatEuro(kpis.stockValue, locale)}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {t("inventory.overview.kpi.stockValueHint")}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
            {t("inventory.overview.kpi.capital")}
          </p>
          <p className="mt-1 text-lg tabular-nums font-semibold">
            {formatEuro(kpis.capitalTied, locale)}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {t("inventory.overview.kpi.capitalHint")}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
            {t("inventory.overview.kpi.avgLanded")}
          </p>
          <p className="mt-1 text-lg tabular-nums font-semibold">
            {formatEuro(kpis.avgLandedPerUnit, locale)}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {t("inventory.overview.kpi.avgLandedHint")}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
            {t("inventory.overview.kpi.openReceipts")}
          </p>
          <p className="mt-1 text-lg tabular-nums font-semibold">
            {formatNumber(kpis.openReceipts, locale)}
          </p>
          <p className="mt-0.5 text-[12px] text-muted">
            {kpis.overdueReceipts > 0
              ? t("inventory.overview.kpi.overdue", {
                  count: String(kpis.overdueReceipts),
                })
              : t("inventory.overview.kpi.openReceiptsHint")}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {scope === "finished" ? (
          <Card>
            <h3 className="mb-1 text-[14px] font-semibold">
              {t("inventory.overview.chart.productTitle")}
            </h3>
            <p className="mb-3 text-[12px] text-muted">
              {t("inventory.overview.chart.productHint")}
            </p>
            {mounted && productChart.hasData ? (
              <ReactApexChart
                type="bar"
                height={Math.max(220, productBars.length * 36 + 40)}
                options={productChart.options}
                series={productChart.series}
              />
            ) : (
              <p className="py-10 text-center text-[13px] text-muted">
                {t("inventory.overview.empty")}
              </p>
            )}
          </Card>
        ) : (
          <Card>
            <h3 className="mb-1 text-[14px] font-semibold">
              {t("inventory.overview.chart.partsTitle")}
            </h3>
            <p className="mb-3 text-[12px] text-muted">
              {t("inventory.overview.chart.partsHint")}
            </p>
            {mounted && componentChart.hasData ? (
              <ReactApexChart
                type="bar"
                height={Math.max(220, componentBars.length * 36 + 48)}
                options={componentChart.options}
                series={componentChart.series}
              />
            ) : (
              <p className="py-10 text-center text-[13px] text-muted">
                {t("inventory.overview.partsEmpty")}
              </p>
            )}
          </Card>
        )}

        <Card>
          <h3 className="mb-1 text-[14px] font-semibold">
            {t("inventory.overview.chart.mixTitle")}
          </h3>
          <p className="mb-3 text-[12px] text-muted">
            {t("inventory.overview.chart.mixHint")}
          </p>
          {mounted && mixChart.hasData ? (
            <ReactApexChart
              type="donut"
              height={280}
              options={mixChart.options}
              series={mixChart.series}
            />
          ) : (
            <p className="py-10 text-center text-[13px] text-muted">
              {t("inventory.overview.empty")}
            </p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-1 text-[14px] font-semibold">
            {t("inventory.overview.chart.mixTitle")}
          </h3>
          <p className="mb-3 text-[12px] text-muted">
            {t("inventory.overview.chart.mixHint")}
          </p>
          {mounted && mixChart.hasData ? (
            <ReactApexChart
              type="donut"
              height={280}
              options={mixChart.options}
              series={mixChart.series}
            />
          ) : (
            <p className="py-10 text-center text-[13px] text-muted">
              {t("inventory.overview.empty")}
            </p>
          )}
        </Card>

        <Card>
          <h3 className="mb-1 text-[14px] font-semibold">
            {t("inventory.overview.chart.fidelityTitle")}
          </h3>
          <p className="mb-3 text-[12px] text-muted">
            {t("inventory.overview.chart.fidelityHint")}
          </p>
          {fidelity.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-muted">
              {t("inventory.overview.fidelityEmpty")}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {fidelity.map((row) => (
                <li
                  key={row.batchId}
                  className="flex items-start justify-between gap-3 py-2.5 text-[13px]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {row.label}
                    </p>
                    <p className="text-[12px] text-muted">
                      {t("inventory.overview.fidelityEta", {
                        date: formatDate(row.eta, locale),
                      })}
                      {row.actual
                        ? ` · ${t("inventory.overview.fidelityActual", {
                            date: formatDate(row.actual, locale),
                          })}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 tabular-nums ${
                      row.overdue
                        ? "font-medium text-danger"
                        : row.deltaDays == null
                          ? "text-muted"
                          : row.deltaDays > 0
                            ? "text-amber-700"
                            : "text-success"
                    }`}
                  >
                    {row.overdue
                      ? t("inventory.overview.fidelityOverdue")
                      : row.deltaDays == null
                        ? t("common.emDash")
                        : row.deltaDays === 0
                          ? t("inventory.overview.fidelityOnTime")
                          : row.deltaDays > 0
                            ? t("inventory.overview.fidelityLate", {
                                days: String(row.deltaDays),
                              })
                            : t("inventory.overview.fidelityEarly", {
                                days: String(Math.abs(row.deltaDays)),
                              })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold">
              {t("inventory.overview.chart.trendTitle")}
            </h3>
            <p className="mt-1 text-[12px] text-muted">
              {scope === "parts"
                ? t("inventory.overview.chart.trendHint")
                : t("inventory.overview.chart.trendHintFinished")}
            </p>
          </div>
          {scope === "parts" && stockTrendComponents.length > 0 ? (
            <label className="flex shrink-0 flex-col gap-1 text-[12px] text-muted">
              <span>{t("inventory.overview.chart.trendFilter")}</span>
              <Select
                value={trendComponentId}
                onChange={(e) => setTrendComponentId(e.target.value)}
                className="min-w-[200px]"
              >
                <option value="">
                  {t("inventory.overview.chart.trendFilterAll")}
                </option>
                {stockTrendComponents.map((c) => (
                  <option key={c.componentId} value={c.componentId}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
        </div>
        {mounted && trendChart.hasData ? (
          <ReactApexChart
            type="area"
            height={260}
            options={trendChart.options}
            series={trendChart.series}
          />
        ) : (
          <p className="py-10 text-center text-[13px] text-muted">
            {t("inventory.overview.trendEmpty")}
          </p>
        )}
      </Card>
    </div>
  );
}
