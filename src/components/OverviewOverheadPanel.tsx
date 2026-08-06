"use client";

import { Fragment, useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import type { OverheadItem } from "@/lib/types";
import type { DateRange } from "@/lib/overview";
import { buildOverheadReport, emptyOverheadItem } from "@/lib/overhead";
import { formatEuro } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { useI18n } from "@/hooks/useI18n";
import { OverheadFormModal } from "@/components/OverheadFormModal";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
} from "@/components/ui";

type Props = {
  range: DateRange;
  /** When true, omit the section title (page already has PageHeader). */
  hidePageHeader?: boolean;
};

export function OverviewOverheadPanel({
  range,
  hidePageHeader = false,
}: Props) {
  const { data, upsertOverheadItem, deleteOverheadItem } = useStore();
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState<OverheadItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OverheadItem | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const report = useMemo(
    () => buildOverheadReport(data, range),
    [data, range],
  );

  const isEdit = Boolean(
    draft && data.overheadItems.some((o) => o.id === draft.id),
  );

  const defaultCurrency =
    data.suppliers.find((s) => s.currency)?.currency ?? "EUR";

  return (
    <div className="space-y-6">
      {hidePageHeader ? (
        <div className="flex justify-end">
          <Button
            onClick={() => setDraft(emptyOverheadItem(defaultCurrency))}
            className="shrink-0"
          >
            {t("overhead.add")}
          </Button>
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
          <Button
            onClick={() => setDraft(emptyOverheadItem(defaultCurrency))}
            className="shrink-0 self-start"
          >
            {t("overhead.add")}
          </Button>
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
        products={data.products}
        isEdit={isEdit}
        defaultCurrency={defaultCurrency}
        onClose={() => setDraft(null)}
        onSave={(item) => upsertOverheadItem(item)}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label={t("overhead.kpi.total")}
          value={formatEuro(report.totalOverhead, locale)}
        />
        <Kpi
          label={t("overhead.kpi.db3")}
          value={formatEuro(report.totalDb3, locale)}
          hint={t("overhead.kpi.db3Hint")}
        />
        <Kpi
          label={t("overhead.kpi.result")}
          value={formatEuro(report.operatingResult, locale)}
          hint={t("overhead.kpi.resultHint")}
          emphasize
          positive={report.operatingResult >= 0}
        />
      </div>

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
                {report.items.map((item) => {
                  const expanded = expandedId === item.id;
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
                          <div className="mt-1 space-y-0.5 text-[11px] text-muted md:hidden">
                            <p>
                              {t(
                                `overhead.period.${item.periode}` as MessageKey,
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
                          {formatEuro(item.betrag, locale)}
                          <span className="ml-1 text-[11px] text-muted-soft">
                            {item.waehrung}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-muted md:table-cell">
                          {t(`overhead.period.${item.periode}` as MessageKey)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            tone={
                              item.kategorie === "vertrieb_fix"
                                ? "accent"
                                : item.kategorie === "verwaltung"
                                  ? "neutral"
                                  : "success"
                            }
                          >
                            {t(
                              `overhead.category.${item.kategorie}` as MessageKey,
                            )}
                          </Badge>
                        </td>
                        <td className="hidden px-4 py-3 text-muted lg:table-cell">
                          {t(
                            `overhead.allocation.${item.verteilschluessel}` as MessageKey,
                          )}
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
                          <td colSpan={4} className="px-4 py-3">
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
                    {formatEuro(report.totalOverhead, locale)}
                  </td>
                  <td className="hidden md:table-cell" />
                  <td className="hidden md:table-cell" />
                  <td className="hidden lg:table-cell" />
                  <td className="hidden px-4 py-3 text-right text-[13px] font-semibold tabular-nums md:table-cell">
                    {formatEuro(report.totalOverhead, locale)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {report.byProduct.length > 0 ? (
        <Card>
          <h3 className="text-[14px] font-medium text-foreground">
            {t("overhead.distribution.title")}
          </h3>
          <p className="mt-1 text-[12px] text-muted">
            {t("overhead.distribution.hint")}
          </p>
          <div className="mt-4 overflow-hidden rounded-[10px] border border-line">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                    <th className="px-3 py-2 font-medium">
                      {t("overhead.distribution.product")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("overhead.distribution.overhead")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("overhead.distribution.db3")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("overhead.distribution.after")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.byProduct.map((row) => (
                    <tr
                      key={row.productId}
                      className="border-b border-line last:border-0"
                    >
                      <td className="px-3 py-2.5 font-medium">{row.name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                        {formatEuro(row.overhead, locale)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {formatEuro(row.db3, locale)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right tabular-nums font-medium ${
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
        </Card>
      ) : null}
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
