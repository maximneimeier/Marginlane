"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import type { CogsCategory, CogsLineItem } from "@/lib/types";
import {
  monthKeyToEndDate,
  monthKeyToStartDate,
  normalizeCompanySettings,
} from "@/lib/companySettings";
import { EMPTY_COMPANY_SETTINGS } from "@/lib/types";
import { monthsKeysInRange } from "@/lib/overhead";
import {
  emptyCogsCategory,
  emptyCogsLineItem,
  getCogsAmount,
  sumCogsForMonths,
  sumCogsLineAcrossMonths,
} from "@/lib/cogsPlan";
import { formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { Button, Card, PageHeader, TextInput } from "@/components/ui";

function formatMonthLabel(key: string, locale: string): string {
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

export default function CogsPageClient() {
  const {
    ready,
    data,
    applyCogsPlanUpdates,
    upsertCogsCategory,
    deleteCogsCategory,
    upsertCogsLineItem,
    deleteCogsLineItem,
  } = useStore();
  const { t, locale } = useI18n();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

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

  const categories = useMemo(
    () =>
      [...(data.cogsCategories ?? [])].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    [data.cogsCategories],
  );

  const lineItems = data.cogsLineItems ?? [];
  const plan = data.cogsPlan ?? [];

  const linesByCategory = useMemo(() => {
    const map = new Map<string, CogsLineItem[]>();
    for (const line of lineItems) {
      const list = map.get(line.categoryId) ?? [];
      list.push(line);
      map.set(line.categoryId, list);
    }
    for (const [id, list] of map) {
      map.set(
        id,
        [...list].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        ),
      );
    }
    return map;
  }, [lineItems]);

  const categoryTotals = useMemo(() => {
    return categories.map((cat) => {
      const ids = (linesByCategory.get(cat.id) ?? []).map((l) => l.id);
      return {
        category: cat,
        byMonth: sumCogsForMonths(plan, months, ids),
        total: sumCogsForMonths(plan, months, ids).reduce((s, v) => s + v, 0),
      };
    });
  }, [categories, linesByCategory, plan, months]);

  const grandByMonth = useMemo(
    () => sumCogsForMonths(plan, months),
    [plan, months],
  );
  const grandTotal = grandByMonth.reduce((s, v) => s + v, 0);

  function draftKey(lineItemId: string, monthKey: string) {
    return `${lineItemId}::${monthKey}`;
  }

  function displayAmount(lineItemId: string, monthKey: string): string {
    const key = draftKey(lineItemId, monthKey);
    if (key in drafts) return drafts[key]!;
    const amount = getCogsAmount(plan, lineItemId, monthKey);
    return amount > 0 ? String(amount) : "";
  }

  function commitAmount(lineItemId: string, monthKey: string, raw: string) {
    const amount = parseNum(raw);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[draftKey(lineItemId, monthKey)];
      return next;
    });
    applyCogsPlanUpdates([{ lineItemId, monthKey, amount }]);
  }

  function displayName(
    id: string,
    current: string,
    kind: "cat" | "line",
  ): string {
    const key = `${kind}:${id}`;
    if (key in nameDrafts) return nameDrafts[key]!;
    return current;
  }

  function commitCategoryName(cat: CogsCategory, raw: string) {
    const name = raw.trim();
    setNameDrafts((prev) => {
      const next = { ...prev };
      delete next[`cat:${cat.id}`];
      return next;
    });
    if (!name || name === cat.name) return;
    upsertCogsCategory({
      ...cat,
      name,
      updatedAt: new Date().toISOString(),
    });
  }

  function commitLineName(line: CogsLineItem, raw: string) {
    const name = raw.trim();
    setNameDrafts((prev) => {
      const next = { ...prev };
      delete next[`line:${line.id}`];
      return next;
    });
    if (!name || name === line.name) return;
    upsertCogsLineItem({
      ...line,
      name,
      updatedAt: new Date().toISOString(),
    });
  }

  function addCategory() {
    upsertCogsCategory(
      emptyCogsCategory(
        categories.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1,
      ),
    );
  }

  function addLine(categoryId: string) {
    const existing = linesByCategory.get(categoryId) ?? [];
    upsertCogsLineItem(
      emptyCogsLineItem(
        categoryId,
        existing.reduce((m, l) => Math.max(m, l.sortOrder), -1) + 1,
      ),
    );
  }

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  const visibleMonths =
    months.length > 18 ? months.slice(0, 18) : months;
  const moreMonths = months.length - visibleMonths.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("cogsPage.title")}
        description={t("cogsPage.description")}
        action={
          <Button type="button" onClick={addCategory}>
            {t("cogsPage.addCategory")}
          </Button>
        }
      />

      <Card className="!p-4">
        <p className="text-[12px] font-medium text-foreground">
          {t("cogsPage.methodTitle")}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">
          {t("cogsPage.methodHint")}
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="!p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
            {t("cogsPage.kpi.total")}
          </p>
          <p className="mt-1 text-[20px] font-semibold tracking-tight text-foreground">
            {formatEuro(grandTotal, locale)}
          </p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
            {t("cogsPage.kpi.categories")}
          </p>
          <p className="mt-1 text-[20px] font-semibold tracking-tight text-foreground">
            {categories.length}
          </p>
        </Card>
      </div>

      {/* Consolidated COGS */}
      <section className="space-y-2">
        <h3 className="text-[14px] font-semibold tracking-tight text-foreground">
          {t("cogsPage.consolidatedTitle")}
        </h3>
        <div className="overflow-x-auto rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
          <table className="w-full min-w-max border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-line bg-surface-soft">
                <th className="sticky left-0 z-10 bg-surface-soft px-3 py-2 text-[11px] font-semibold text-muted">
                  {t("cogsPage.col.category")}
                </th>
                {visibleMonths.map((m) => (
                  <th
                    key={m}
                    className="min-w-[5.5rem] px-2 py-2 text-right text-[11px] font-semibold tabular-nums text-muted"
                  >
                    {formatMonthLabel(m, locale)}
                  </th>
                ))}
                <th className="min-w-[5.5rem] px-2 py-2 text-right text-[11px] font-semibold tabular-nums text-muted">
                  {t("cogsPage.col.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {categoryTotals.map(({ category, byMonth, total }) => (
                <tr
                  key={category.id}
                  className="border-b border-line hover:bg-surface-faint"
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-foreground">
                    {category.name || t("cogsPage.unnamedCategory")}
                  </td>
                  {visibleMonths.map((m, i) => (
                    <td
                      key={m}
                      className="px-2 py-2 text-right tabular-nums text-foreground"
                    >
                      {(byMonth[i] ?? 0) > 0
                        ? formatEuro(byMonth[i]!, locale)
                        : "—"}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground">
                    {total > 0 ? formatEuro(total, locale) : "—"}
                  </td>
                </tr>
              ))}
              <tr className="bg-surface-soft">
                <td className="sticky left-0 z-10 bg-surface-soft px-3 py-2.5 font-semibold text-foreground">
                  {t("cogsPage.totalCogs")}
                </td>
                {visibleMonths.map((m, i) => (
                  <td
                    key={m}
                    className="px-2 py-2.5 text-right font-semibold tabular-nums text-foreground"
                  >
                    {(grandByMonth[i] ?? 0) > 0
                      ? formatEuro(grandByMonth[i]!, locale)
                      : "—"}
                  </td>
                ))}
                <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-foreground">
                  {formatEuro(grandTotal, locale)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {moreMonths > 0 ? (
          <p className="text-[11px] text-muted">
            {t("cogsPage.moreMonths", { count: String(moreMonths) })}
          </p>
        ) : null}
      </section>

      {/* Detail sections */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const lines = linesByCategory.get(cat.id) ?? [];
          const ids = lines.map((l) => l.id);
          const catByMonth = sumCogsForMonths(plan, months, ids);
          const catTotal = catByMonth.reduce((s, v) => s + v, 0);

          return (
            <section
              key={cat.id}
              className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]"
            >
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-faint/60 px-3 py-2">
                <TextInput
                  value={displayName(cat.id, cat.name, "cat")}
                  onChange={(e) =>
                    setNameDrafts((prev) => ({
                      ...prev,
                      [`cat:${cat.id}`]: e.target.value,
                    }))
                  }
                  onBlur={(e) => commitCategoryName(cat, e.target.value)}
                  placeholder={t("cogsPage.unnamedCategory")}
                  className="!max-w-xs !border-transparent !bg-transparent !px-1 !py-1 font-semibold shadow-none hover:!border-line focus:!border-accent"
                />
                <div className="ml-auto flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => addLine(cat.id)}
                  >
                    {t("cogsPage.addLine")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => deleteCogsCategory(cat.id)}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="sticky left-0 z-10 bg-white px-3 py-2 text-[11px] font-semibold text-muted">
                        {t("cogsPage.col.line")}
                      </th>
                      {visibleMonths.map((m) => (
                        <th
                          key={m}
                          className="min-w-[5.5rem] px-2 py-2 text-right text-[11px] font-semibold tabular-nums text-muted"
                        >
                          {formatMonthLabel(m, locale)}
                        </th>
                      ))}
                      <th className="min-w-[5.5rem] px-2 py-2 text-right text-[11px] font-semibold tabular-nums text-muted">
                        {t("cogsPage.col.total")}
                      </th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const lineTotal = sumCogsLineAcrossMonths(
                        plan,
                        line.id,
                        months,
                      );
                      return (
                        <tr
                          key={line.id}
                          className="border-b border-line hover:bg-surface-faint"
                        >
                          <td className="sticky left-0 z-10 bg-white px-1.5 py-1">
                            <TextInput
                              value={displayName(line.id, line.name, "line")}
                              onChange={(e) =>
                                setNameDrafts((prev) => ({
                                  ...prev,
                                  [`line:${line.id}`]: e.target.value,
                                }))
                              }
                              onBlur={(e) =>
                                commitLineName(line, e.target.value)
                              }
                              placeholder={t("cogsPage.unnamedLine")}
                              className="!border-transparent !bg-transparent !px-1.5 !py-1 shadow-none hover:!border-line focus:!border-accent"
                            />
                          </td>
                          {visibleMonths.map((m) => (
                            <td key={m} className="px-1 py-1">
                              <TextInput
                                inputMode="decimal"
                                className="!px-2 !py-1.5 text-right tabular-nums"
                                placeholder="0"
                                value={displayAmount(line.id, m)}
                                onChange={(e) =>
                                  setDrafts((prev) => ({
                                    ...prev,
                                    [draftKey(line.id, m)]: e.target.value,
                                  }))
                                }
                                onBlur={(e) =>
                                  commitAmount(line.id, m, e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    (e.target as HTMLInputElement).blur();
                                  }
                                }}
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-right tabular-nums text-foreground">
                            {lineTotal > 0
                              ? formatEuro(lineTotal, locale)
                              : "—"}
                          </td>
                          <td className="px-2 py-1">
                            <button
                              type="button"
                              onClick={() => deleteCogsLineItem(line.id)}
                              className="text-[11px] text-muted hover:text-danger"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-surface-soft">
                      <td className="sticky left-0 z-10 bg-surface-soft px-3 py-2 font-semibold text-foreground">
                        {t("cogsPage.sectionTotal")}
                      </td>
                      {visibleMonths.map((m, i) => (
                        <td
                          key={m}
                          className="px-2 py-2 text-right font-semibold tabular-nums text-foreground"
                        >
                          {(catByMonth[i] ?? 0) > 0
                            ? formatEuro(catByMonth[i]!, locale)
                            : "—"}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-foreground">
                        {catTotal > 0 ? formatEuro(catTotal, locale) : "—"}
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
