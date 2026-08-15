"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import type { CatalogProduct, RevenuePlanCell } from "@/lib/types";
import {
  monthKeyToEndDate,
  monthKeyToStartDate,
  normalizeCompanySettings,
} from "@/lib/companySettings";
import { EMPTY_COMPANY_SETTINGS } from "@/lib/types";
import { monthsKeysInRange } from "@/lib/overhead";
import {
  applyVolumeGrowth,
  averageSellingPrice,
  distributeAnnualVolume,
  getRevenuePlanCell,
  setProductUnitPrice,
  sumQuantityPlan,
  sumRevenuePlan,
} from "@/lib/revenuePlan";
import { SEASON_PROFILE_IDS, type SeasonProfileId } from "@/lib/salesPlan";
import { formatEuro, formatNumber } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";
import { Button, Card, PageHeader, Select, TextInput } from "@/components/ui";

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

function parseNum(raw: string): number {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return 0;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

const SEASON_LABEL: Record<SeasonProfileId, MessageKey> = {
  even: "revenuePage.season.even",
  h2_heavy: "revenuePage.season.h2",
  q4_peak: "revenuePage.season.q4",
  summer_peak: "revenuePage.season.summer",
};

export default function RevenuePageClient() {
  const { ready, data, applyRevenuePlanUpdates } = useStore();
  const { t, locale, lang } = useI18n();
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const companySettings = normalizeCompanySettings(
    data.companySettings ?? EMPTY_COMPANY_SETTINGS,
  );

  const months = useMemo(() => {
    const from =
      monthKeyToStartDate(companySettings.modelStartMonth) ??
      `${new Date().getFullYear()}-01-01`;
    const to =
      monthKeyToEndDate(companySettings.lastActualMonth) ??
      `${new Date().getFullYear()}-12-31`;
    return monthsKeysInRange({ from, to });
  }, [companySettings.modelStartMonth, companySettings.lastActualMonth]);

  const years = useMemo(
    () => [...new Set(months.map((m) => m.slice(0, 4)))].sort(),
    [months],
  );

  const plan = data.revenuePlan ?? [];

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(data.catalogProducts ?? [])]
      .filter((p) => p.status === "active")
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [data.catalogProducts, query, lang]);

  const grandTotal = sumRevenuePlan(plan, { monthKeys: months });

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("revenuePage.title")}
        description={t("revenuePage.description")}
      />

      <Card className="!p-4">
        <p className="text-[12px] font-medium text-foreground">
          {t("revenuePage.methodTitle")}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          {t("revenuePage.methodHint")}
        </p>
        <ul className="mt-2 grid gap-1.5 text-[12px] text-muted sm:grid-cols-3">
          <li>· {t("revenuePage.method.priceVolume")}</li>
          <li>· {t("revenuePage.method.annual")}</li>
          <li>· {t("revenuePage.method.growth")}</li>
        </ul>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="!p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
            {t("revenuePage.kpi.total")}
          </p>
          <p className="mt-1 text-[20px] font-semibold tracking-tight text-foreground">
            {formatEuro(grandTotal, locale)}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
            {t("revenuePage.kpi.products")}
          </p>
          <p className="mt-1 text-[20px] font-semibold tracking-tight text-foreground">
            {products.length}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
            {t("revenuePage.kpi.periods")}
          </p>
          <p className="mt-1 text-[20px] font-semibold tracking-tight text-foreground">
            {months.length}
          </p>
        </Card>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("revenuePage.search")}
          className="sm:max-w-xs"
        />
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

      {products.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-line px-4 py-12 text-center">
          <p className="text-[14px] font-medium text-foreground">
            {t("revenuePage.emptyProducts")}
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">
            {t("revenuePage.emptyProductsHint")}
          </p>
          <Link
            href="/products"
            className="mt-4 inline-block text-[13px] font-medium text-accent hover:underline"
          >
            {t("revenuePage.emptyProductsLink")}
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
            <ProductRevenueCard
              key={product.id}
              product={product}
              plan={plan}
              months={months}
              years={years}
              periodMode={periodMode}
              expanded={expandedId === product.id}
              onToggle={() =>
                setExpandedId((id) => (id === product.id ? null : product.id))
              }
              onApply={applyRevenuePlanUpdates}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductRevenueCard({
  product,
  plan,
  months,
  years,
  periodMode,
  expanded,
  onToggle,
  onApply,
  locale,
}: {
  product: CatalogProduct;
  plan: RevenuePlanCell[];
  months: string[];
  years: string[];
  periodMode: PeriodMode;
  expanded: boolean;
  onToggle: () => void;
  onApply: (updates: RevenuePlanCell[]) => void;
  locale: string;
}) {
  const { t } = useI18n();
  const listPrice = Math.max(0, product.listPrice ?? 0);

  const productRev = sumRevenuePlan(plan, {
    productId: product.id,
    monthKeys: months,
  });
  const productQty = sumQuantityPlan(plan, {
    productId: product.id,
    monthKeys: months,
  });
  const asp = averageSellingPrice(plan, {
    productId: product.id,
    monthKeys: months,
  });

  const [annualQty, setAnnualQty] = useState("");
  const [annualPrice, setAnnualPrice] = useState(
    listPrice > 0 ? String(listPrice) : "",
  );
  const [growthPct, setGrowthPct] = useState("10");
  const [season, setSeason] = useState<SeasonProfileId>("even");
  const [selectedYear, setSelectedYear] = useState(years[0] ?? "");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const periods = periodMode === "month" ? months : years;

  function draftKey(period: string, field: "qty" | "price") {
    return `${period}:${field}`;
  }

  function monthKeysForPeriod(period: string): string[] {
    if (periodMode === "month") return [period];
    return months.filter((m) => m.startsWith(`${period}-`));
  }

  function displayQty(period: string): string {
    const key = draftKey(period, "qty");
    if (key in drafts) return drafts[key]!;
    const keys = monthKeysForPeriod(period);
    const qty = sumQuantityPlan(plan, {
      productId: product.id,
      monthKeys: keys,
    });
    return qty > 0 ? String(qty) : "";
  }

  function displayPrice(period: string): string {
    const key = draftKey(period, "price");
    if (key in drafts) return drafts[key]!;
    if (periodMode === "month") {
      const cell = getRevenuePlanCell(plan, product.id, period);
      const price = cell?.unitPrice ?? 0;
      return price > 0 ? String(price) : "";
    }
    const keys = monthKeysForPeriod(period);
    const price = averageSellingPrice(plan, {
      productId: product.id,
      monthKeys: keys,
    });
    return price > 0 ? String(Math.round(price * 100) / 100) : "";
  }

  function periodRevenue(period: string): number {
    return sumRevenuePlan(plan, {
      productId: product.id,
      monthKeys: monthKeysForPeriod(period),
    });
  }

  function commitCell(period: string, field: "qty" | "price", raw: string) {
    const value = parseNum(raw);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[draftKey(period, field)];
      return next;
    });

    if (periodMode === "month") {
      const existing = getRevenuePlanCell(plan, product.id, period);
      const quantity =
        field === "qty" ? value : (existing?.quantity ?? 0);
      const unitPrice =
        field === "price"
          ? value
          : existing?.unitPrice && existing.unitPrice > 0
            ? existing.unitPrice
            : listPrice;
      onApply([
        {
          productId: product.id,
          monthKey: period,
          quantity,
          unitPrice,
        },
      ]);
      return;
    }

    // Jahr: Menge verteilen / Preis setzen
    const yearMonths = monthKeysForPeriod(period);
    if (field === "qty") {
      const price =
        averageSellingPrice(plan, {
          productId: product.id,
          monthKeys: yearMonths,
        }) || listPrice;
      onApply(
        distributeAnnualVolume(
          product.id,
          period,
          value,
          price,
          months,
          "even",
        ),
      );
      return;
    }
    onApply(setProductUnitPrice(product.id, plan, yearMonths, value));
  }

  function applyAnnual() {
    const year = selectedYear || years[0];
    if (!year) return;
    onApply(
      distributeAnnualVolume(
        product.id,
        year,
        parseNum(annualQty),
        parseNum(annualPrice) || listPrice,
        months,
        season,
      ),
    );
  }

  function applyGrowth() {
    onApply(
      applyVolumeGrowth(
        product.id,
        plan,
        months,
        parseNum(growthPct),
        listPrice,
      ),
    );
  }

  function applyListPrice() {
    if (listPrice <= 0) return;
    onApply(setProductUnitPrice(product.id, plan, months, listPrice));
  }

  return (
    <div className="rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-faint"
      >
        <span
          className={`text-muted-soft transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
          aria-hidden
        >
          ›
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">
            {product.name}
          </p>
          <p className="truncate text-[11px] text-muted">
            {[product.sku, product.category].filter(Boolean).join(" · ") ||
              t("common.emDash")}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-[12px] tabular-nums text-muted">
            {formatNumber(productQty, locale)} {t("revenuePage.units")}
          </p>
          <p className="text-[11px] tabular-nums text-muted-soft">
            ASP{" "}
            {asp > 0 ? formatEuro(asp, locale) : t("common.emDash")}
          </p>
        </div>
        <p className="min-w-[5.5rem] text-right text-[13px] font-semibold tabular-nums text-foreground">
          {formatEuro(productRev, locale)}
        </p>
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-line px-4 py-4">
          <div className="grid gap-3 rounded-[10px] border border-line bg-surface-faint/40 p-3 lg:grid-cols-3">
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-foreground">
                {t("revenuePage.strategy.annual")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="!w-auto min-w-[5rem]"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
                <Select
                  value={season}
                  onChange={(e) =>
                    setSeason(e.target.value as SeasonProfileId)
                  }
                  className="!w-auto min-w-[8rem]"
                >
                  {SEASON_PROFILE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {t(SEASON_LABEL[id])}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-wrap gap-2">
                <TextInput
                  inputMode="decimal"
                  placeholder={t("revenuePage.strategy.annualQty")}
                  value={annualQty}
                  onChange={(e) => setAnnualQty(e.target.value)}
                  className="!w-28"
                />
                <TextInput
                  inputMode="decimal"
                  placeholder={t("revenuePage.strategy.asp")}
                  value={annualPrice}
                  onChange={(e) => setAnnualPrice(e.target.value)}
                  className="!w-28"
                />
                <Button type="button" onClick={applyAnnual}>
                  {t("revenuePage.strategy.apply")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[12px] font-medium text-foreground">
                {t("revenuePage.strategy.growth")}
              </p>
              <p className="text-[11px] text-muted">
                {t("revenuePage.strategy.growthHint")}
              </p>
              <div className="flex flex-wrap gap-2">
                <TextInput
                  inputMode="decimal"
                  value={growthPct}
                  onChange={(e) => setGrowthPct(e.target.value)}
                  className="!w-20"
                  aria-label={t("revenuePage.strategy.growth")}
                />
                <span className="self-center text-[12px] text-muted">%</span>
                <Button type="button" onClick={applyGrowth}>
                  {t("revenuePage.strategy.apply")}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[12px] font-medium text-foreground">
                {t("revenuePage.strategy.price")}
              </p>
              <p className="text-[11px] text-muted">
                {listPrice > 0
                  ? t("revenuePage.strategy.listPriceHint", {
                      price: formatEuro(listPrice, locale),
                    })
                  : t("revenuePage.strategy.noListPrice")}
              </p>
              <Button
                type="button"
                onClick={applyListPrice}
                disabled={listPrice <= 0}
              >
                {t("revenuePage.strategy.useListPrice")}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-[10px] border border-line">
            <table className="w-full min-w-max border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-line bg-surface-soft">
                  <th className="px-3 py-2 text-[11px] font-semibold text-muted">
                    {t("revenuePage.col.period")}
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted">
                    {t("revenuePage.col.qty")}
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted">
                    {t("revenuePage.col.asp")}
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-muted">
                    {t("revenuePage.col.revenue")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => (
                  <tr
                    key={period}
                    className="border-b border-line last:border-b-0"
                  >
                    <td className="px-3 py-1.5 font-medium text-foreground">
                      {formatPeriodLabel(period, periodMode, locale)}
                    </td>
                    <td className="px-1.5 py-1">
                      <TextInput
                        inputMode="decimal"
                        className="!px-2 !py-1.5 text-right tabular-nums"
                        placeholder="0"
                        value={displayQty(period)}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [draftKey(period, "qty")]: e.target.value,
                          }))
                        }
                        onBlur={(e) =>
                          commitCell(period, "qty", e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                    </td>
                    <td className="px-1.5 py-1">
                      <TextInput
                        inputMode="decimal"
                        className="!px-2 !py-1.5 text-right tabular-nums"
                        placeholder="0"
                        value={displayPrice(period)}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [draftKey(period, "price")]: e.target.value,
                          }))
                        }
                        onBlur={(e) =>
                          commitCell(period, "price", e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-foreground">
                      {(() => {
                        const qtyDraft = draftKey(period, "qty") in drafts;
                        const priceDraft =
                          draftKey(period, "price") in drafts;
                        const amount =
                          qtyDraft || priceDraft
                            ? parseNum(displayQty(period)) *
                              (parseNum(displayPrice(period)) || listPrice)
                            : periodRevenue(period);
                        return amount > 0
                          ? formatEuro(amount, locale)
                          : "—";
                      })()}
                    </td>
                  </tr>
                ))}
                <tr className="bg-surface-faint">
                  <td className="px-3 py-2 font-semibold text-foreground">
                    {t("revenuePage.col.total")}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                    {formatNumber(productQty, locale)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">
                    {asp > 0 ? formatEuro(asp, locale) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                    {formatEuro(productRev, locale)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
