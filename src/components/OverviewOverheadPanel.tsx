"use client";

import { Fragment, useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import type { OverheadCostBehavior, OverheadItem } from "@/lib/types";
import { OVERHEAD_COST_BEHAVIORS } from "@/lib/types";
import type { DateRange } from "@/lib/overview";
import { buildOverheadReport, buildOverheadAllocationIssues, emptyOverheadItem } from "@/lib/overhead";
import { formatEuro } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { useI18n } from "@/hooks/useI18n";
import { OverheadFormModal } from "@/components/OverheadFormModal";
import { OverheadStackedBarChart } from "@/components/OverheadStackedBarChart";
import { OverheadAllocationSankeyChart } from "@/components/OverheadAllocationSankeyChart";
import { OverheadResultWaterfallChart } from "@/components/OverheadResultWaterfallChart";
import { OverheadPlanVsActualPanel } from "@/components/OverheadPlanVsActualPanel";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Select,
} from "@/components/ui";

type Props = {
  range: DateRange;
  /** When true, omit the section title (page already has PageHeader). */
  hidePageHeader?: boolean;
};

type OverheadTab = "tables" | "charts" | "planVsActual";

export function OverviewOverheadPanel({
  range,
  hidePageHeader = false,
}: Props) {
  const { data, upsertOverheadItem, deleteOverheadItem } = useStore();
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState<OverheadItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OverheadItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<OverheadTab>("tables");
  const [kostenartFilter, setKostenartFilter] = useState<
    "all" | OverheadCostBehavior
  >("all");

  const report = useMemo(
    () => buildOverheadReport(data, range),
    [data, range],
  );

  const allocationIssues = useMemo(
    () => buildOverheadAllocationIssues(data, range),
    [data, range],
  );

  const issuesByItem = useMemo(() => {
    const map = new Map<string, typeof allocationIssues>();
    for (const issue of allocationIssues) {
      const list = map.get(issue.itemId) ?? [];
      list.push(issue);
      map.set(issue.itemId, list);
    }
    return map;
  }, [allocationIssues]);

  const filteredItems = useMemo(() => {
    if (kostenartFilter === "all") return report.items;
    return report.items.filter(
      (item) => (item.kostenart ?? "fix") === kostenartFilter,
    );
  }, [report.items, kostenartFilter]);

  const isEdit = Boolean(
    draft && data.overheadItems.some((o) => o.id === draft.id),
  );

  const defaultCurrency =
    data.suppliers.find((s) => s.currency)?.currency ?? "EUR";

  const tabSwitch = (
    <div className="flex rounded-[8px] border border-line bg-white p-0.5">
      <button
        type="button"
        onClick={() => setTab("tables")}
        className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
          tab === "tables"
            ? "bg-surface-soft text-foreground"
            : "text-muted hover:text-foreground"
        }`}
      >
        {t("overhead.tab.tables")}
      </button>
      <button
        type="button"
        onClick={() => setTab("planVsActual")}
        className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
          tab === "planVsActual"
            ? "bg-surface-soft text-foreground"
            : "text-muted hover:text-foreground"
        }`}
      >
        {t("overhead.tab.planVsActual")}
      </button>
      <button
        type="button"
        onClick={() => setTab("charts")}
        className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
          tab === "charts"
            ? "bg-surface-soft text-foreground"
            : "text-muted hover:text-foreground"
        }`}
      >
        {t("overhead.tab.charts")}
      </button>
    </div>
  );

  const addButton =
    tab === "tables" ? (
      <Button
        onClick={() => setDraft(emptyOverheadItem(defaultCurrency))}
        className="shrink-0"
      >
        {t("overhead.add")}
      </Button>
    ) : null;

  return (
    <div className="space-y-6">
      {hidePageHeader ? (
        <div className="flex flex-col items-end gap-2">
          {tabSwitch}
          {addButton}
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[18px] font-semibold tracking-tight text-foreground">
              {t("overhead.title")}
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              {t("overhead.description")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 self-start">
            {tabSwitch}
            {addButton}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("overhead.deleteTitle")}
        description={
          deleteTarget
            ? t("overhead.deleteDescription", { name: deleteTarget.name })
            : ""
        }
        confirmLabel={t("common.deleteConfirm")}
        onConfirm={() => {
          if (deleteTarget) deleteOverheadItem(deleteTarget.id);
        }}
      />

      <OverheadFormModal
        open={Boolean(draft)}
        initial={draft}
        products={data.catalogProducts}
        isEdit={isEdit}
        defaultCurrency={defaultCurrency}
        onClose={() => setDraft(null)}
        onSave={(item) => upsertOverheadItem(item)}
      />

      {tab === "tables" ? (
        <div className="space-y-6">
          {report.items.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <OverheadKpi
                label={t("overhead.kpi.total")}
                value={formatEuro(report.totalOverhead, locale)}
              />
              <OverheadKpi
                label={t("overhead.kpi.db3")}
                value={formatEuro(report.totalDb3, locale)}
                hint={t("overhead.kpi.db3Hint")}
              />
              <OverheadKpi
                label={t("overhead.kpi.result")}
                value={formatEuro(report.operatingResult, locale)}
                hint={t("overhead.kpi.resultHint")}
                emphasize
                positive={report.operatingResult >= 0}
              />
            </div>
          ) : null}

          {report.items.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-line px-4 py-12 text-center">
              <p className="text-[14px] font-medium text-foreground">
                {t("overhead.emptyTitle")}
              </p>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">
                {t("overhead.emptyDescription")}
              </p>
              <Button
                className="mt-4"
                onClick={() => setDraft(emptyOverheadItem(defaultCurrency))}
              >
                {t("overhead.emptyCta")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {allocationIssues.length > 0 ? (
                <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
                  <p className="font-medium">
                    {t("overhead.drivers.title", {
                      count: String(allocationIssues.length),
                    })}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-amber-900/90">
                    {allocationIssues.map((issue, idx) => (
                      <li key={`${issue.itemId}:${issue.kind}:${idx}`}>
                        <span className="font-medium">{issue.itemName}</span>
                        {" — "}
                        {formatAllocationIssue(issue, t)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <label className="flex items-center gap-2 text-[12px] text-muted">
                  <span>{t("overhead.filter.kostenart")}</span>
                  <Select
                    value={kostenartFilter}
                    onChange={(e) =>
                      setKostenartFilter(
                        e.target.value as "all" | OverheadCostBehavior,
                      )
                    }
                    className="!w-[180px] !py-1.5"
                  >
                    <option value="all">
                      {t("overhead.filter.kostenart.all")}
                    </option>
                    {OVERHEAD_COST_BEHAVIORS.map((c) => (
                      <option key={c} value={c}>
                        {t(`overhead.costBehavior.${c}` as MessageKey)}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                      <th className="px-4 py-2.5 font-medium">
                        {t("overhead.col.name")}
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        {t("overhead.col.betrag")}
                      </th>
                      <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                        {t("overhead.col.periode")}
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        {t("overhead.col.kategorie")}
                      </th>
                      <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                        {t("overhead.col.kostenart")}
                      </th>
                      <th className="hidden px-4 py-2.5 font-medium lg:table-cell">
                        {t("overhead.col.verteilschluessel")}
                      </th>
                      <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">
                        {t("overhead.col.periodAmount")}
                      </th>
                      <th className="w-28 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-8 text-center text-[13px] text-muted"
                        >
                          {t("overhead.filter.kostenart.empty")}
                        </td>
                      </tr>
                    ) : null}
                    {filteredItems.map((item) => {
                      const expanded = expandedId === item.id;
                      const kostenart = item.kostenart ?? "fix";
                      const itemIssues = issuesByItem.get(item.id) ?? [];
                      const hasDriverWarn = itemIssues.length > 0;
                      return (
                        <Fragment key={item.id}>
                          <tr className="group border-b border-line last:border-0 hover:bg-surface-faint">
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedId(expanded ? null : item.id)
                                }
                                className="text-left font-medium text-foreground hover:text-accent md:cursor-default md:hover:text-foreground"
                              >
                                {item.name}
                              </button>
                              <p className="mt-0.5 text-[11px] text-muted-soft">
                                {formatValidity(item, t, locale)}
                              </p>
                              {item.updatedAt ? (
                                <p className="mt-0.5 text-[11px] text-muted-soft">
                                  {formatAudit(item, t, locale)}
                                </p>
                              ) : null}
                              {hasDriverWarn ? (
                                <p className="mt-1 text-[11px] text-amber-700 md:hidden">
                                  {t("overhead.drivers.rowHint")}
                                </p>
                              ) : null}
                              <div className="mt-1 space-y-0.5 text-[11px] text-muted md:hidden">
                                <p>
                                  {t(
                                    `overhead.period.${item.periode}` as MessageKey,
                                  )}{" "}
                                  ·{" "}
                                  {t(
                                    `overhead.costBehavior.${kostenart}` as MessageKey,
                                  )}{" "}
                                  ·{" "}
                                  {t(
                                    `overhead.allocation.${item.verteilschluessel}` as MessageKey,
                                  )}
                                </p>
                                <p className="tabular-nums">
                                  {t("overhead.col.periodAmount")}:{" "}
                                  {formatEuro(item.periodAmount, locale)}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {kostenart === "variabel" &&
                              item.variableBasis &&
                              item.variableRate != null ? (
                                <span title={t("overhead.field.variableBasis")}>
                                  {formatVariableDriver(item, locale)}
                                </span>
                              ) : (
                                <>
                                  {formatEuro(item.betrag, locale)}
                                  <span className="ml-1 text-[11px] text-muted-soft">
                                    {item.waehrung}
                                  </span>
                                </>
                              )}
                              {kostenart === "semi_variabel" &&
                              item.variableBasis &&
                              item.variableRate != null ? (
                                <p className="mt-0.5 text-[11px] font-normal text-muted-soft">
                                  + {formatVariableDriver(item, locale)}
                                </p>
                              ) : null}
                            </td>
                            <td className="hidden px-4 py-3 text-muted md:table-cell">
                              {t(
                                `overhead.period.${item.periode}` as MessageKey,
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                tone={
                                  item.kategorie === "vertriebsgemeinkosten"
                                    ? "accent"
                                    : item.kategorie ===
                                        "fertigungsgemeinkosten"
                                      ? "success"
                                      : "neutral"
                                }
                              >
                                {t(
                                  `overhead.category.${item.kategorie}` as MessageKey,
                                )}
                              </Badge>
                            </td>
                            <td className="hidden px-4 py-3 md:table-cell">
                              <Badge
                                tone={
                                  kostenart === "variabel"
                                    ? "accent"
                                    : kostenart === "semi_variabel"
                                      ? "success"
                                      : "neutral"
                                }
                              >
                                {t(
                                  `overhead.costBehavior.${kostenart}` as MessageKey,
                                )}
                              </Badge>
                              {item.variableBasis &&
                              item.variableRate != null &&
                              kostenart !== "fix" ? (
                                <p className="mt-1 text-[11px] text-muted-soft">
                                  {t(
                                    `overhead.variableBasis.${item.variableBasis}` as MessageKey,
                                  )}
                                </p>
                              ) : null}
                            </td>
                            <td className="hidden px-4 py-3 lg:table-cell">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-muted">
                                  {t(
                                    `overhead.allocation.${item.verteilschluessel}` as MessageKey,
                                  )}
                                </span>
                                {hasDriverWarn ? (
                                  <span
                                    className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                                    title={itemIssues
                                      .map((i) => formatAllocationIssue(i, t))
                                      .join(" · ")}
                                  >
                                    {t("overhead.drivers.badge")}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="hidden px-4 py-3 text-right tabular-nums font-medium md:table-cell">
                              {formatEuro(item.periodAmount, locale)}
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex justify-end gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                <Button
                                  variant="ghost"
                                  className="!h-7 !px-2 text-[12px]"
                                  onClick={() => setDraft(item)}
                                >
                                  {t("common.edit")}
                                </Button>
                                <Button
                                  variant="danger"
                                  className="!h-7 !px-2 text-[12px]"
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  {t("common.delete")}
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {expanded ? (
                            <tr className="border-b border-line bg-surface-faint md:hidden">
                              <td colSpan={5} className="px-4 py-3">
                                <dl className="grid grid-cols-2 gap-2 text-[12px]">
                                  <div>
                                    <dt className="text-muted-soft">
                                      {t("overhead.col.periode")}
                                    </dt>
                                    <dd className="mt-0.5 text-foreground">
                                      {t(
                                        `overhead.period.${item.periode}` as MessageKey,
                                      )}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-soft">
                                      {t("overhead.col.kostenart")}
                                    </dt>
                                    <dd className="mt-0.5 text-foreground">
                                      {t(
                                        `overhead.costBehavior.${kostenart}` as MessageKey,
                                      )}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-soft">
                                      {t("overhead.col.verteilschluessel")}
                                    </dt>
                                    <dd className="mt-0.5 text-foreground">
                                      {t(
                                        `overhead.allocation.${item.verteilschluessel}` as MessageKey,
                                      )}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-muted-soft">
                                      {t("overhead.col.periodAmount")}
                                    </dt>
                                    <dd className="mt-0.5 tabular-nums text-foreground">
                                      {formatEuro(item.periodAmount, locale)}
                                    </dd>
                                  </div>
                                </dl>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-line bg-surface-faint">
                      <td className="px-4 py-3 text-[13px] font-semibold text-foreground">
                        {t("overhead.table.total")}
                      </td>
                      <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums md:hidden">
                        {formatEuro(
                          filteredItems.reduce(
                            (acc, i) => acc + i.periodAmount,
                            0,
                          ),
                          locale,
                        )}
                      </td>
                      <td className="hidden md:table-cell" />
                      <td className="hidden md:table-cell" />
                      <td className="hidden md:table-cell" />
                      <td className="hidden lg:table-cell" />
                      <td className="hidden px-4 py-3 text-right text-[13px] font-semibold tabular-nums md:table-cell">
                        {formatEuro(
                          filteredItems.reduce(
                            (acc, i) => acc + i.periodAmount,
                            0,
                          ),
                          locale,
                        )}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            </div>
          )}

          {report.byProduct.length > 0 ? (
            <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
              <div className="border-b border-line px-4 py-3">
                <h3 className="text-[14px] font-medium text-foreground">
                  {t("overhead.distribution.title")}
                </h3>
                <p className="mt-0.5 text-[12px] text-muted">
                  {t("overhead.distribution.hint")}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                      <th className="px-4 py-2.5 font-medium">
                        {t("overhead.distribution.product")}
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        {t("overhead.distribution.overhead")}
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        {t("overhead.distribution.db3")}
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        {t("overhead.distribution.after")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byProduct.map((row) => (
                      <tr
                        key={row.productId}
                        className="border-b border-line last:border-0 hover:bg-surface-faint"
                      >
                        <td className="px-4 py-3 font-medium">
                          {row.name}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {formatEuro(row.overhead, locale)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatEuro(row.db3, locale)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right tabular-nums font-medium ${
                            row.afterOverhead >= 0
                              ? "text-success"
                              : "text-danger"
                          }`}
                        >
                          {formatEuro(row.afterOverhead, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : tab === "charts" ? (
        <div className="space-y-6">
          <OverheadResultWaterfallChart data={data} range={range} />
          <OverheadStackedBarChart
            items={data.overheadItems}
            range={range}
            data={data}
          />
          <OverheadAllocationSankeyChart data={data} range={range} />
        </div>
      ) : (
        <OverheadPlanVsActualPanel range={range} />
      )}
    </div>
  );
}

function formatValidity(
  item: OverheadItem,
  t: (key: MessageKey, vars?: Record<string, string>) => string,
  locale: string,
): string {
  const von = item.gueltigVon;
  const bis = item.gueltigBis;
  if (!von && !bis) return t("overhead.validity.unbounded");

  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (von && bis) {
    return t("overhead.validity.range", { from: fmt(von), to: fmt(bis) });
  }
  if (von) return t("overhead.validity.from", { from: fmt(von) });
  return t("overhead.validity.until", { to: fmt(bis!) });
}

function formatVariableDriver(item: OverheadItem, locale: string): string {
  const rate = item.variableRate ?? 0;
  if (item.variableBasis === "umsatz") {
    return `${rate.toLocaleString(locale, { maximumFractionDigits: 2 })} %`;
  }
  return `${formatEuro(rate, locale)} / Stk.`;
}

function formatAudit(
  item: OverheadItem,
  t: (key: MessageKey, vars?: Record<string, string>) => string,
  locale: string,
): string {
  const iso = item.updatedAt || item.createdAt;
  const d = new Date(iso);
  const when = Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
  if (item.updatedBy) {
    return t("overhead.audit.updatedBy", {
      when,
      who: item.updatedBy,
    });
  }
  return t("overhead.audit.updatedAt", { when });
}

function formatAllocationIssue(
  issue: {
    kind: "manual_empty" | "manual_sum" | "inactive_products";
    percentSum?: number;
    productNames?: string[];
  },
  t: (key: MessageKey, vars?: Record<string, string>) => string,
): string {
  if (issue.kind === "manual_empty") {
    return t("overhead.drivers.manualEmpty");
  }
  if (issue.kind === "manual_sum") {
    return t("overhead.drivers.manualSum", {
      sum: String(issue.percentSum ?? 0),
    });
  }
  return t("overhead.drivers.inactiveProducts", {
    products: (issue.productNames ?? []).join(", "),
  });
}

function OverheadKpi({
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
            : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
    </Card>
  );
}
