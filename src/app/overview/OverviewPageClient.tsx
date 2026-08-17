"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import { usePrefs } from "@/context/PreferencesContext";
import {
  buildOverview,
  buildMarginTrend,
  defaultOverviewRange,
  rangeForPreset,
  type BreakdownRow,
  type DatePreset,
  type DateRange,
} from "@/lib/overview";
import { buildOverheadReport } from "@/lib/overhead";
import { formatEuro, formatPercent } from "@/lib/format";
import { FEATURES } from "@/lib/features";
import { useI18n } from "@/hooks/useI18n";
import { OverviewWaterfallChart } from "@/components/OverviewWaterfallChart";
import { OverviewSankeyChart } from "@/components/OverviewSankeyChart";
import { OverheadResultWaterfallChart } from "@/components/OverheadResultWaterfallChart";
import { SalesPlanOverviewStrip } from "@/components/SalesPlanOverviewStrip";
import { MarginTrendChart } from "@/components/MarginTrendChart";
import { ProductFilterDropdown } from "@/components/ProductFilterDropdown";
import { Card, Field, PageHeader, Select, TextInput } from "@/components/ui";

type BreakdownMode = "product" | "supplier" | "dealer";

export default function OverviewPage() {
  const { ready, data } = useStore();
  const { prefs } = usePrefs();
  const { t, locale } = useI18n();
  const isCosterra = prefs.activeModule === "batches";

  const [preset, setPreset] = useState<DatePreset>("this_year");
  const [range, setRange] = useState<DateRange>(() => defaultOverviewRange());
  /** Per-chart product filters (`null` = all). Independent of each other. */
  const [waterfallProducts, setWaterfallProducts] = useState<string[] | null>(
    null,
  );
  const [sankeyProducts, setSankeyProducts] = useState<string[] | null>(null);
  const [breakdownProducts, setBreakdownProducts] = useState<string[] | null>(
    null,
  );
  const [cashflowProducts, setCashflowProducts] = useState<string[] | null>(
    null,
  );
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>(
    isCosterra ? "supplier" : "product",
  );

  const showConsolidation = FEATURES.overviewConsolidation;
  const showCashflow = FEATURES.overviewCashflow && !isCosterra;
  const showSalesPlan = FEATURES.salesVolumePlanning && !isCosterra;
  const showInvestaOverheadCharts = showConsolidation && !isCosterra;

  const products = useMemo(
    () =>
      [...data.catalogProducts].sort((a, b) => a.name.localeCompare(b.name)),
    [data.catalogProducts],
  );

  /** KPIs: all products in date range (Phase 2 consolidation only). */
  const kpiReport = useMemo(
    () =>
      showConsolidation
        ? buildOverview(data, range, { productIds: null })
        : null,
    [data, range, showConsolidation],
  );
  const marginTrend = useMemo(
    () =>
      showConsolidation
        ? buildMarginTrend(data, range, { productIds: null })
        : [],
    [data, range, showConsolidation],
  );
  const waterfallReport = useMemo(
    () =>
      showConsolidation
        ? buildOverview(data, range, { productIds: waterfallProducts })
        : null,
    [data, range, waterfallProducts, showConsolidation],
  );
  const sankeyReport = useMemo(
    () =>
      showConsolidation
        ? buildOverview(data, range, { productIds: sankeyProducts })
        : null,
    [data, range, sankeyProducts, showConsolidation],
  );
  const breakdownReport = useMemo(
    () =>
      showConsolidation
        ? buildOverview(data, range, { productIds: breakdownProducts })
        : null,
    [data, range, breakdownProducts, showConsolidation],
  );
  const cashflowReport = useMemo(
    () =>
      showCashflow
        ? buildOverview(data, range, { productIds: cashflowProducts })
        : null,
    [data, range, cashflowProducts, showCashflow],
  );
  const overheadReport = useMemo(
    () => (showConsolidation ? buildOverheadReport(data, range) : null),
    [data, range, showConsolidation],
  );

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  function applyPreset(next: DatePreset) {
    setPreset(next);
    if (next !== "custom") {
      setRange(rangeForPreset(next));
    }
  }

  function updateRange(partial: Partial<DateRange>) {
    setPreset("custom");
    setRange((prev) => ({ ...prev, ...partial }));
  }

  const breakdown =
    breakdownReport == null
      ? []
      : breakdownMode === "product"
        ? breakdownReport.byProduct
        : breakdownMode === "supplier"
          ? breakdownReport.bySupplier
          : breakdownReport.byDealer;
  const maxAbsDb3 = Math.max(...breakdown.map((r) => Math.abs(r.db3)), 1);
  const maxCash = Math.max(
    ...(cashflowReport?.cashFlow.flatMap((p) => [p.inflow, p.outflow]) ?? [0]),
    1,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          isCosterra
            ? t("overviewPage.titleCosterra")
            : t("overviewPage.title")
        }
        description={
          isCosterra
            ? t("overviewPage.descriptionCosterra")
            : showConsolidation
              ? t("overviewPage.description")
              : t("overviewPage.descriptionMvp")
        }
        action={
          isCosterra ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/batches"
                className="inline-flex h-8 items-center rounded-[8px] border border-line px-3 text-[13px] font-medium text-foreground hover:bg-surface-faint"
              >
                {t("overviewPage.link.batches")}
              </Link>
              <Link
                href="/compare"
                className="inline-flex h-8 items-center rounded-[8px] border border-line px-3 text-[13px] font-medium text-foreground hover:bg-surface-faint"
              >
                {t("overviewPage.link.compare")}
              </Link>
            </div>
          ) : undefined
        }
      />

      <Card className="!p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <Field label={t("overviewPage.from")}>
              <TextInput
                type="date"
                value={range.from}
                onChange={(e) => updateRange({ from: e.target.value })}
              />
            </Field>
            <Field label={t("overviewPage.to")}>
              <TextInput
                type="date"
                value={range.to}
                onChange={(e) => updateRange({ to: e.target.value })}
              />
            </Field>
            <Field label={t("overviewPage.preset")}>
              <Select
                value={preset}
                onChange={(e) => applyPreset(e.target.value as DatePreset)}
              >
                <option value="this_year">
                  {t("overviewPage.preset.thisYear")}
                </option>
                <option value="last_quarter">
                  {t("overviewPage.preset.lastQuarter")}
                </option>
                <option value="last_12_months">
                  {t("overviewPage.preset.last12")}
                </option>
                <option value="custom">{t("overviewPage.preset.custom")}</option>
              </Select>
            </Field>
          </div>
          {showConsolidation && kpiReport ? (
            <p className="shrink-0 text-[12px] text-muted lg:pb-2">
              {t("overviewPage.batchCount", {
                count: kpiReport.kpis.batchCount,
              })}
            </p>
          ) : null}
        </div>
      </Card>

      {showConsolidation && kpiReport ? (
        <>
          {kpiReport.kpis.uncategorized > 0 ? (
            <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-950">
              {t("overviewPage.uncategorizedWarning", {
                amount: formatEuro(kpiReport.kpis.uncategorized, locale),
              })}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi
              label={t("overviewPage.kpi.revenue")}
              value={formatEuro(kpiReport.kpis.revenue, locale)}
            />
            <Kpi
              label={t("overviewPage.kpi.db1")}
              value={formatEuro(kpiReport.kpis.db1, locale)}
              hint={t("overviewPage.kpi.db1Hint")}
            />
            <Kpi
              label={t("overviewPage.kpi.db2")}
              value={formatEuro(kpiReport.kpis.db2, locale)}
              hint={t("overviewPage.kpi.db2Hint")}
            />
            <Kpi
              label={t("overviewPage.kpi.db3")}
              value={formatEuro(kpiReport.kpis.db3, locale)}
              hint={t("overviewPage.kpi.db3Hint")}
              positive={kpiReport.kpis.db3 >= 0}
            />
            <Kpi
              label={t("overviewPage.kpi.margin")}
              value={formatPercent(kpiReport.kpis.marginPercent, locale)}
              hint={t("overviewPage.kpi.marginHint")}
              positive={kpiReport.kpis.marginPercent >= 0}
            />
          </div>

          {isCosterra ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label={t("overviewPage.kpi.material")}
                value={formatEuro(kpiReport.kpis.material, locale)}
              />
              <Kpi
                label={t("overviewPage.kpi.logistics")}
                value={formatEuro(kpiReport.kpis.logistics, locale)}
              />
              <Kpi
                label={t("overviewPage.kpi.marketing")}
                value={formatEuro(kpiReport.kpis.marketing, locale)}
              />
              <Kpi
                label={t("overviewPage.kpi.salesCosts")}
                value={formatEuro(kpiReport.kpis.sales, locale)}
              />
            </div>
          ) : null}

          {overheadReport && !isCosterra ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Kpi
                label={t("overviewPage.kpi.overhead")}
                value={formatEuro(overheadReport.totalOverhead, locale)}
                hint={t("overviewPage.kpi.overheadHint")}
              />
              <Kpi
                label={t("overviewPage.kpi.personnel")}
                value={formatEuro(overheadReport.personnelAmount, locale)}
                hint={t("overviewPage.kpi.personnelHint")}
              />
              <Kpi
                label={t("overviewPage.kpi.result")}
                value={formatEuro(overheadReport.operatingResult, locale)}
                hint={t("overviewPage.kpi.resultHint")}
                emphasize
                positive={overheadReport.operatingResult >= 0}
              />
            </div>
          ) : null}

          {overheadReport && isCosterra ? (
            <Card className="!p-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                    {t("overviewPage.kpi.result")}
                  </p>
                  <p
                    className={`mt-1 text-[20px] font-semibold tabular-nums ${
                      overheadReport.operatingResult >= 0
                        ? "text-success"
                        : "text-danger"
                    }`}
                  >
                    {formatEuro(overheadReport.operatingResult, locale)}
                  </p>
                  <p className="mt-1 text-[12px] text-muted">
                    {t("overviewPage.costerraResultHint", {
                      overhead: formatEuro(
                        overheadReport.totalOverhead,
                        locale,
                      ),
                    })}
                  </p>
                </div>
                <Link
                  href="/overhead/personnel"
                  className="text-[13px] font-medium text-accent hover:underline"
                >
                  {t("overviewPage.link.overhead")}
                </Link>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      {showSalesPlan ? <SalesPlanOverviewStrip range={range} /> : null}

      {showConsolidation ? (
        <div className="mb-4">
          <MarginTrendChart points={marginTrend} />
        </div>
      ) : null}

      {showInvestaOverheadCharts ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[12px] text-muted">
              {t("overviewPage.resultChartHint")}
            </p>
            <Link
              href="/overhead"
              className="text-[12px] font-medium text-accent hover:underline"
            >
              {t("overviewPage.resultChartLink")}
            </Link>
          </div>
          <OverheadResultWaterfallChart data={data} range={range} />
        </div>
      ) : null}

      {showConsolidation && waterfallReport ? (
        <Card>
          <ChartHeader
            title={
              isCosterra
                ? t("overviewPage.waterfallTitleCosterra")
                : t("overviewPage.waterfallTitle")
            }
            hint={
              isCosterra
                ? t("overviewPage.waterfallHintCosterra")
                : t("overviewPage.waterfallHint")
            }
            products={products}
            productFilter={waterfallProducts}
            onProductFilterChange={setWaterfallProducts}
            productLabel={t("overviewPage.products")}
          />
          {waterfallReport.kpis.batchCount === 0 ? (
            <p className="mt-4 text-[13px] text-muted">
              {t("overviewPage.empty")}
            </p>
          ) : (
            <div className="mt-5">
              <OverviewWaterfallChart steps={waterfallReport.waterfall} />
            </div>
          )}
        </Card>
      ) : null}

      {showConsolidation && sankeyReport ? (
        <Card>
          <ChartHeader
            title={t("overviewPage.sankeyTitle")}
            hint={t("overviewPage.sankeyHint")}
            products={products}
            productFilter={sankeyProducts}
            onProductFilterChange={setSankeyProducts}
            productLabel={t("overviewPage.products")}
          />
          {sankeyReport.kpis.batchCount === 0 ? (
            <p className="mt-4 text-[13px] text-muted">
              {t("overviewPage.empty")}
            </p>
          ) : (
            <OverviewSankeyChart
              kpis={sankeyReport.kpis}
              products={sankeyReport.byProduct}
            />
          )}
        </Card>
      ) : null}

      {showConsolidation && breakdownReport ? (
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-[14px] font-medium text-foreground">
                {isCosterra
                  ? t("overviewPage.breakdownTitleCosterra")
                  : t("overviewPage.breakdownTitle")}
              </h2>
              <p className="mt-1 text-[12px] text-muted">
                {isCosterra
                  ? t("overviewPage.breakdownHintCosterra")
                  : t("overviewPage.breakdownHint")}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="w-full sm:w-[220px]">
                <Field label={t("overviewPage.products")}>
                  <ProductFilterDropdown
                    products={products}
                    value={breakdownProducts}
                    onChange={setBreakdownProducts}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-1 rounded-[8px] border border-line bg-surface-faint p-0.5">
                <ModeButton
                  active={breakdownMode === "product"}
                  onClick={() => setBreakdownMode("product")}
                >
                  {t("overviewPage.byProduct")}
                </ModeButton>
                <ModeButton
                  active={breakdownMode === "supplier"}
                  onClick={() => setBreakdownMode("supplier")}
                >
                  {t("overviewPage.bySupplier")}
                </ModeButton>
                {isCosterra ? (
                  <ModeButton
                    active={breakdownMode === "dealer"}
                    onClick={() => setBreakdownMode("dealer")}
                  >
                    {t("overviewPage.byDealer")}
                  </ModeButton>
                ) : null}
              </div>
            </div>
          </div>

          {breakdown.length === 0 ? (
            <p className="text-[13px] text-muted">{t("overviewPage.empty")}</p>
          ) : (
            <div className="space-y-5">
              <BreakdownBars
                rows={breakdown.slice(0, 8)}
                maxAbs={maxAbsDb3}
                locale={locale}
              />
              <BreakdownTable
                rows={breakdown}
                mode={breakdownMode}
                locale={locale}
              />
            </div>
          )}
        </Card>
      ) : null}

      {showCashflow && cashflowReport ? (
        <Card>
          <ChartHeader
            title={t("overviewPage.cashTitle")}
            hint={t("overviewPage.cashDisclaimer")}
            products={products}
            productFilter={cashflowProducts}
            onProductFilterChange={setCashflowProducts}
            productLabel={t("overviewPage.products")}
          />
          {cashflowReport.cashFlow.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted">
              {t("overviewPage.empty")}
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {cashflowReport.cashFlow.map((point) => (
                <div key={point.month}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="font-medium text-foreground">
                      {formatMonth(point.month, locale)}
                    </span>
                    <span
                      className={`tabular-nums ${
                        point.net >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      {t("overviewPage.cashNet")}:{" "}
                      {formatEuro(point.net, locale)}
                    </span>
                  </div>
                  <div className="grid gap-1.5">
                    <CashBar
                      label={t("overviewPage.cashIn")}
                      amount={point.inflow}
                      max={maxCash}
                      tone="in"
                      locale={locale}
                    />
                    <CashBar
                      label={t("overviewPage.cashOut")}
                      amount={point.outflow}
                      max={maxCash}
                      tone="out"
                      locale={locale}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function ChartHeader({
  title,
  hint,
  products,
  productFilter,
  onProductFilterChange,
  productLabel,
}: {
  title: string;
  hint: string;
  products: { id: string; name: string }[];
  productFilter: string[] | null;
  onProductFilterChange: (next: string[] | null) => void;
  productLabel: string;
}) {
  return (
    <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-[14px] font-medium text-foreground">{title}</h2>
        <p className="mt-1 text-[12px] text-muted">{hint}</p>
      </div>
      <div className="w-full shrink-0 sm:w-[220px]">
        <Field label={productLabel}>
          <ProductFilterDropdown
            products={products}
            value={productFilter}
            onChange={onProductFilterChange}
          />
        </Field>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  emphasize,
  positive,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
  positive?: boolean;
}) {
  return (
    <Card className="!p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
        {label}
      </p>
      <p
        className={`mt-1 text-[20px] font-semibold tabular-nums tracking-tight ${
          emphasize
            ? positive
              ? "text-success"
              : "text-danger"
            : positive === false
              ? "text-danger"
              : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </Card>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[6px] px-2.5 py-1 text-[12px] ${
        active
          ? "bg-white font-medium text-foreground shadow-[var(--shadow-sm)]"
          : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function BreakdownBars({
  rows,
  maxAbs,
  locale,
}: {
  rows: BreakdownRow[];
  maxAbs: number;
  locale: string;
}) {
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const width = Math.min(100, (Math.abs(row.db3) / maxAbs) * 100);
        return (
          <div key={row.id}>
            <div className="mb-1 flex justify-between gap-2 text-[12px]">
              <span className="truncate text-muted">{row.name}</span>
              <span
                className={`shrink-0 tabular-nums ${
                  row.db3 >= 0 ? "text-foreground" : "text-danger"
                }`}
              >
                {formatEuro(row.db3, locale)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-soft">
              <div
                className={`h-full rounded-full ${
                  row.db3 >= 0 ? "bg-accent" : "bg-danger/70"
                }`}
                style={{ width: `${Math.max(width, 2)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BreakdownTable({
  rows,
  mode,
  locale,
}: {
  rows: BreakdownRow[];
  mode: BreakdownMode;
  locale: string;
}) {
  const { t } = useI18n();
  const href =
    mode === "product"
      ? "/products"
      : mode === "supplier"
        ? "/suppliers"
        : "/dealers";
  const nameCol =
    mode === "product"
      ? t("overviewPage.col.product")
      : mode === "supplier"
        ? t("overviewPage.col.supplier")
        : t("overviewPage.col.dealer");

  return (
    <div className="overflow-hidden rounded-[10px] border border-line">
      <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_0.7fr_0.6fr] gap-2 border-b border-line bg-surface-faint px-3 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
        <span>{nameCol}</span>
        <span className="text-right">{t("overviewPage.col.revenue")}</span>
        <span className="text-right">{t("overviewPage.col.db3")}</span>
        <span className="text-right">{t("overviewPage.col.margin")}</span>
        <span className="text-right">{t("overviewPage.col.batches")}</span>
      </div>
      <ul>
        {rows.map((row) => (
          <li
            key={row.id}
            className="grid grid-cols-[1.4fr_0.9fr_0.9fr_0.7fr_0.6fr] items-center gap-2 border-b border-line px-3 py-2.5 text-[13px] last:border-0"
          >
            <span className="min-w-0 truncate font-medium">
              <Link href={href} className="hover:text-accent" title={row.name}>
                {row.name}
              </Link>
            </span>
            <span className="text-right tabular-nums text-muted">
              {formatEuro(row.revenue, locale)}
            </span>
            <span
              className={`text-right tabular-nums ${
                row.db3 >= 0 ? "text-foreground" : "text-danger"
              }`}
            >
              {formatEuro(row.db3, locale)}
            </span>
            <span className="text-right tabular-nums text-muted">
              {formatPercent(row.marginPercent, locale)}
            </span>
            <span className="text-right tabular-nums text-muted-soft">
              {row.batchCount}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CashBar({
  label,
  amount,
  max,
  tone,
  locale,
}: {
  label: string;
  amount: number;
  max: number;
  tone: "in" | "out";
  locale: string;
}) {
  const width = Math.min(100, (amount / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] text-muted">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-soft">
        <div
          className={`h-full rounded-full ${
            tone === "in" ? "bg-success/70" : "bg-danger/60"
          }`}
          style={{ width: `${Math.max(width, amount > 0 ? 2 : 0)}%` }}
        />
      </div>
      <span className="w-[88px] shrink-0 text-right text-[12px] tabular-nums text-foreground">
        {formatEuro(amount, locale)}
      </span>
    </div>
  );
}

function formatMonth(ym: string, locale: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}
