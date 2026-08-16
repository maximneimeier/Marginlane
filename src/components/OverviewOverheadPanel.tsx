"use client";

import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import type {
  CompanySettings,
  OverheadCostBehavior,
  OverheadItem,
  PersonnelHireFrequency,
  PersonnelRole,
  PersonnelRoleType,
  PersonnelTeam,
} from "@/lib/types";
import {
  EMPTY_COMPANY_SETTINGS,
  OVERHEAD_COST_BEHAVIORS,
  PERSONNEL_HIRE_FREQUENCIES,
  PERSONNEL_ROLE_TYPES,
} from "@/lib/types";
import type { DateRange } from "@/lib/overview";
import {
  buildOverheadReport,
  buildOverheadAllocationIssues,
  emptyOverheadItem,
} from "@/lib/overhead";
import {
  annualSalary,
  emptyPersonnelRole,
  employerCostBreakdown,
  monthlyDependencyTotal,
  withCompanyPersonnelDefaults,
} from "@/lib/personnel";
import {
  normalizeCompanySettings,
  personnelDefaultsFromCompany,
  monthKeyToStartDate,
  monthKeyToEndDate,
  clampIsoDate,
  earlierIsoDate,
  laterIsoDate,
} from "@/lib/companySettings";
import { formatEuro, formatNumber } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { useI18n } from "@/hooks/useI18n";
import { OverheadFormModal } from "@/components/OverheadFormModal";
import { PersonnelRoleFormModal } from "@/components/PersonnelRoleFormModal";
import { PersonnelMonthlyMatrix } from "@/components/PersonnelMonthlyMatrix";
import { PersonnelCharts } from "@/components/PersonnelCharts";
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
  TableRowActions,
  TextInput,
} from "@/components/ui";
import { FEATURES } from "@/lib/features";

type Props = {
  range: DateRange;
  /** When true, omit the section title (page already has PageHeader). */
  hidePageHeader?: boolean;
  /** Which section to show — nav routes map to separate pages. */
  section?: "positions" | "personnel";
  /** Costerra: nur Erfassung + Umlage, ohne Plan/Ist und Charts */
  simpleMode?: boolean;
};

type OverheadTab = "tables" | "charts" | "planVsActual";

export function OverviewOverheadPanel({
  range,
  hidePageHeader = false,
  section = "positions",
  simpleMode = false,
}: Props) {
  const {
    data,
    upsertOverheadItem,
    deleteOverheadItem,
    upsertPersonnelRole,
    deletePersonnelRole,
  } = useStore();
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState<OverheadItem | null>(null);
  const [personnelDraft, setPersonnelDraft] = useState<PersonnelRole | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<OverheadItem | null>(null);
  const [deletePersonnelTarget, setDeletePersonnelTarget] =
    useState<PersonnelRole | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<OverheadTab>("tables");
  const [personnelTab, setPersonnelTab] = useState<
    "roles" | "matrix" | "charts"
  >("roles");
  const [kostenartFilter, setKostenartFilter] = useState<
    "all" | OverheadCostBehavior
  >("all");

  const showPlanVsActual = FEATURES.overheadPlanVsActual && !simpleMode;
  const showCharts = FEATURES.overheadCharts && !simpleMode;
  const showTabSwitch =
    (!simpleMode && section === "personnel") ||
    (section === "positions" && (showPlanVsActual || showCharts));
  const activeTab: OverheadTab =
    section === "personnel"
      ? "tables"
      : tab === "planVsActual" && !showPlanVsActual
        ? "tables"
        : tab === "charts" && !showCharts
          ? "tables"
          : tab;

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

  const roles = useMemo(
    () =>
      [...(data.personnelRoles ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [data.personnelRoles],
  );

  const isEdit = Boolean(
    draft && data.overheadItems.some((o) => o.id === draft.id),
  );
  const isPersonnelEdit = Boolean(
    personnelDraft &&
      (data.personnelRoles ?? []).some((r) => r.id === personnelDraft.id),
  );

  const companySettings = normalizeCompanySettings(
    data.companySettings ?? EMPTY_COMPANY_SETTINGS,
  );
  const personnelDefaults = useMemo(
    () => personnelDefaultsFromCompany(companySettings),
    [
      companySettings.personnelDefaultLines,
      companySettings.defaultLohnnebenkostenPercent,
      companySettings.defaultZusatzAgPercent,
      companySettings.defaultBenefitsMonthly,
      companySettings.defaultAnnualIncreasePercent,
    ],
  );
  const defaultCurrency =
    companySettings.baseCurrency ||
    data.suppliers.find((s) => s.currency)?.currency ||
    "EUR";

  const newPersonnelRole = () =>
    emptyPersonnelRole(defaultCurrency, personnelDefaults);

  const tabSwitch = showTabSwitch ? (
    <div className="flex flex-wrap rounded-[8px] border border-line bg-white p-0.5">
      {section === "personnel" ? (
        <>
          <button
            type="button"
            onClick={() => setPersonnelTab("roles")}
            className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
              personnelTab === "roles"
                ? "bg-surface-soft text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t("personnel.tab.roles")}
          </button>
          <button
            type="button"
            onClick={() => setPersonnelTab("matrix")}
            className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
              personnelTab === "matrix"
                ? "bg-surface-soft text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t("personnel.tab.matrix")}
          </button>
          <button
            type="button"
            onClick={() => setPersonnelTab("charts")}
            className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
              personnelTab === "charts"
                ? "bg-surface-soft text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t("personnel.tab.charts")}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setTab("tables")}
            className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
              activeTab === "tables"
                ? "bg-surface-soft text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t("overhead.tab.tables")}
          </button>
          {showPlanVsActual ? (
            <button
              type="button"
              onClick={() => setTab("planVsActual")}
              className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
                activeTab === "planVsActual"
                  ? "bg-surface-soft text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t("overhead.tab.planVsActual")}
            </button>
          ) : null}
          {showCharts ? (
            <button
              type="button"
              onClick={() => setTab("charts")}
              className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
                activeTab === "charts"
                  ? "bg-surface-soft text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t("overhead.tab.charts")}
            </button>
          ) : null}
        </>
      )}
    </div>
  ) : null;

  const addButton =
    section === "personnel" && personnelTab === "roles" ? (
      <Button
        onClick={() => setPersonnelDraft(newPersonnelRole())}
        className="shrink-0"
      >
        {t("personnel.add")}
      </Button>
    ) : section === "positions" && activeTab === "tables" ? (
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

      <ConfirmDialog
        open={Boolean(deletePersonnelTarget)}
        onClose={() => setDeletePersonnelTarget(null)}
        title={t("personnel.deleteTitle")}
        description={
          deletePersonnelTarget
            ? t("personnel.deleteDescription", {
                name: deletePersonnelTarget.name,
              })
            : ""
        }
        confirmLabel={t("common.deleteConfirm")}
        onConfirm={() => {
          if (deletePersonnelTarget)
            deletePersonnelRole(deletePersonnelTarget.id);
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

      <PersonnelRoleFormModal
        open={Boolean(personnelDraft)}
        initial={personnelDraft}
        products={data.catalogProducts}
        teams={data.personnelTeams ?? []}
        isEdit={isPersonnelEdit}
        defaultCurrency={defaultCurrency}
        personnelDefaults={personnelDefaults}
        modelDateMin={monthKeyToStartDate(companySettings.modelStartMonth)}
        modelDateMax={monthKeyToEndDate(companySettings.lastActualMonth)}
        onClose={() => setPersonnelDraft(null)}
        onSave={(role) =>
          upsertPersonnelRole(
            withCompanyPersonnelDefaults(role, personnelDefaults),
          )
        }
      />

      {section === "personnel" ? (
        <PersonnelRolesSection
          roles={roles}
          teams={data.personnelTeams ?? []}
          companySettings={companySettings}
          personnelAmount={report.personnelAmount}
          locale={locale}
          view={personnelTab}
          onEdit={(role) => setPersonnelDraft(structuredClone(role))}
          onDelete={(role) => setDeletePersonnelTarget(role)}
          onCreate={() => setPersonnelDraft(newPersonnelRole())}
          onUpdate={(role) =>
            upsertPersonnelRole(
              withCompanyPersonnelDefaults(role, personnelDefaults),
            )
          }
        />
      ) : null}

      {section === "positions" && activeTab === "tables" ? (
        <div className="space-y-6">
          {report.items.length > 0 || report.personnelAmount > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <OverheadKpi
                label={t("overhead.kpi.total")}
                value={formatEuro(report.totalOverhead, locale)}
              />
              <OverheadKpi
                label={t("overhead.kpi.personnel")}
                value={formatEuro(report.personnelAmount, locale)}
                hint={t("overhead.kpi.personnelHint")}
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
      ) : section === "positions" && activeTab === "charts" && showCharts ? (
        <div className="space-y-6">
          <OverheadResultWaterfallChart data={data} range={range} />
          <OverheadStackedBarChart
            items={data.overheadItems}
            range={range}
            data={data}
          />
          <OverheadAllocationSankeyChart data={data} range={range} />
        </div>
      ) : section === "positions" &&
        activeTab === "planVsActual" &&
        showPlanVsActual ? (
        <OverheadPlanVsActualPanel range={range} />
      ) : null}
    </div>
  );
}

function parseLocaleNumber(raw: string, locale: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  const normalized =
    locale.startsWith("de") || locale.startsWith("fr")
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

const sheetQuiet =
  "!border-transparent !bg-transparent !shadow-none hover:!border-transparent hover:!bg-surface-faint focus:!border-line focus:!bg-white focus:!shadow-[0_0_0_2px_rgba(38,109,240,0.12)]";

function SheetNum({
  value,
  locale,
  onCommit,
  suffix,
  className = "",
  widthClass = "!w-[5.5rem]",
}: {
  value: number;
  locale: string;
  onCommit: (next: number) => void;
  suffix?: string;
  className?: string;
  widthClass?: string;
}) {
  return (
    <div className={`flex items-center justify-end gap-0.5 ${className}`}>
      <TextInput
        inputMode="decimal"
        className={`h-8 ${widthClass} ${sheetQuiet} shrink-0 rounded-[6px] px-2 py-0 text-right text-[12px] tabular-nums`}
        defaultValue={
          value === 0 ? "" : formatNumber(value, locale)
        }
        key={`${value}-${locale}`}
        onBlur={(e) => {
          const parsed = parseLocaleNumber(e.target.value, locale);
          onCommit(parsed === null ? 0 : Math.max(0, parsed));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      {suffix ? (
        <span className="shrink-0 text-[11px] text-muted">{suffix}</span>
      ) : null}
    </div>
  );
}

function SheetText({
  value,
  onCommit,
  placeholder,
  className = "",
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <TextInput
      className={`h-9 min-h-9 ${sheetQuiet} rounded-[6px] px-2 py-0 text-[13px] font-medium ${className}`}
      defaultValue={value}
      key={value}
      placeholder={placeholder}
      onBlur={(e) => {
        const next = e.target.value.trim();
        if (next !== value.trim()) onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function SheetDate({
  value,
  onCommit,
  min,
  max,
}: {
  value: string | null;
  onCommit: (next: string | null) => void;
  min?: string | null;
  max?: string | null;
}) {
  return (
    <TextInput
      type="date"
      className={`h-8 w-[8.25rem] min-w-0 ${sheetQuiet} rounded-[6px] px-1.5 py-0 text-[12px]`}
      value={value ?? ""}
      min={min || undefined}
      max={max || undefined}
      onChange={(e) =>
        onCommit(clampIsoDate(e.target.value || null, min, max))
      }
    />
  );
}

const sheetSelectClass = `h-8 w-full rounded-[6px] border border-transparent bg-transparent px-2 py-0 text-[12px] leading-none text-foreground outline-none transition-[border-color,background-color,box-shadow] hover:bg-surface-faint focus:border-line focus:bg-white focus:shadow-[0_0_0_2px_rgba(38,109,240,0.12)]`;

function SheetSelect({
  value,
  onChange,
  children,
  className = "",
  title,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <select
      value={value}
      title={title}
      onChange={(e) => onChange(e.target.value)}
      className={`${sheetSelectClass} ${className}`}
    >
      {children}
    </select>
  );
}

function CtcBreakdownCell({
  role,
  locale,
}: {
  role: PersonnelRole;
  locale: string;
}) {
  const { t } = useI18n();
  const cellRef = useRef<HTMLTableCellElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const breakdown = employerCostBreakdown(role);
  const hc = Math.max(0, role.headcount || 0);
  const roleTotal = breakdown.total * hc;

  function show() {
    const rect = cellRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.top - 8, left: rect.right });
    setOpen(true);
  }

  const rows: { label: string; value: string; strong?: boolean }[] = [
    {
      label: t("personnel.ctcBreakdown.brutto"),
      value: formatEuro(breakdown.brutto, locale),
    },
    {
      label: t("personnel.ctcBreakdown.nk", {
        pct: formatNumber(breakdown.nkPercent, locale),
      }),
      value: formatEuro(breakdown.nkAmount, locale),
    },
    {
      label: t("personnel.ctcBreakdown.zusatz", {
        pct: formatNumber(breakdown.zusatzPercent, locale),
      }),
      value: formatEuro(breakdown.zusatzAmount, locale),
    },
    {
      label: t("personnel.ctcBreakdown.benefits"),
      value: formatEuro(breakdown.benefits, locale),
    },
    {
      label: t("personnel.ctcBreakdown.total"),
      value: formatEuro(breakdown.total, locale),
      strong: true,
    },
  ];

  if (hc !== 1) {
    rows.push({
      label: t("personnel.ctcBreakdown.roleTotal", {
        hc: formatNumber(hc, locale),
      }),
      value: formatEuro(roleTotal, locale),
      strong: true,
    });
  }

  return (
    <td
      ref={cellRef}
      className="px-2 py-2 text-right font-medium tabular-nums"
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="cursor-default border-b border-dotted border-muted-soft/80">
        {formatEuro(breakdown.total, locale)}
      </span>
      {open
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[80] w-[240px] -translate-x-full -translate-y-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-left shadow-[0_12px_40px_rgba(28,29,31,0.16)]"
              style={{ top: pos.top, left: pos.left }}
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-soft">
                {t("personnel.ctcBreakdown.title")}
              </p>
              <dl className="space-y-1.5">
                {rows.map((row) => (
                  <div
                    key={row.label}
                    className={`flex items-baseline justify-between gap-3 ${
                      row.strong ? "border-t border-line pt-1.5" : ""
                    }`}
                  >
                    <dt
                      className={`text-[11px] leading-snug ${
                        row.strong ? "font-medium text-foreground" : "text-muted"
                      }`}
                    >
                      {row.label}
                    </dt>
                    <dd
                      className={`shrink-0 text-[12px] tabular-nums ${
                        row.strong ? "font-semibold text-foreground" : "text-foreground"
                      }`}
                    >
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>,
            document.body,
          )
        : null}
    </td>
  );
}

function PackagesBreakdownCell({
  role,
  locale,
}: {
  role: PersonnelRole;
  locale: string;
}) {
  const { t } = useI18n();
  const cellRef = useRef<HTMLTableCellElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const monthly = monthlyDependencyTotal(role);
  const monthlyDeps = (role.dependencies ?? []).filter(
    (d) => d.cadence === "monatlich" && (d.amount || 0) > 0,
  );
  const oneTimeDeps = (role.dependencies ?? []).filter(
    (d) => d.cadence === "einmalig" && (d.amount || 0) > 0,
  );
  const hc = Math.max(0, role.headcount || 0);

  function show() {
    const rect = cellRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.top - 8, left: rect.right });
    setOpen(true);
  }

  return (
    <td
      ref={cellRef}
      className="px-2 py-2 text-right tabular-nums text-muted"
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="cursor-default border-b border-dotted border-muted-soft/80">
        {monthly > 0 ? formatEuro(monthly, locale) : t("common.emDash")}
      </span>
      {open
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[80] w-[250px] -translate-x-full -translate-y-full rounded-[10px] border border-line bg-white px-3 py-2.5 text-left shadow-[0_12px_40px_rgba(28,29,31,0.16)]"
              style={{ top: pos.top, left: pos.left }}
            >
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-soft">
                {t("personnel.packagesBreakdown.title")}
              </p>
              {monthlyDeps.length === 0 && oneTimeDeps.length === 0 ? (
                <p className="text-[12px] text-muted">
                  {t("personnel.packagesBreakdown.empty")}
                </p>
              ) : (
                <dl className="space-y-1.5">
                  {monthlyDeps.map((dep) => {
                    const amount = Math.max(0, dep.amount || 0);
                    const line = dep.scalesWithHeadcount
                      ? amount * hc
                      : amount;
                    return (
                      <div
                        key={dep.id}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <dt className="text-[11px] leading-snug text-muted">
                          {dep.name || t("personnel.deps.namePlaceholder")}
                          {dep.scalesWithHeadcount
                            ? ` × ${formatNumber(hc, locale)}`
                            : ""}
                        </dt>
                        <dd className="shrink-0 text-[12px] tabular-nums text-foreground">
                          {formatEuro(line, locale)}
                        </dd>
                      </div>
                    );
                  })}
                  {monthlyDeps.length > 0 ? (
                    <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5">
                      <dt className="text-[11px] font-medium text-foreground">
                        {t("personnel.packagesBreakdown.total")}
                      </dt>
                      <dd className="shrink-0 text-[12px] font-semibold tabular-nums text-foreground">
                        {formatEuro(monthly, locale)}
                      </dd>
                    </div>
                  ) : null}
                  {oneTimeDeps.length > 0 ? (
                    <>
                      <p className="pt-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-soft">
                        {t("personnel.packagesBreakdown.oneTime")}
                      </p>
                      {oneTimeDeps.map((dep) => (
                        <div
                          key={dep.id}
                          className="flex items-baseline justify-between gap-3"
                        >
                          <dt className="text-[11px] leading-snug text-muted">
                            {dep.name || t("personnel.deps.namePlaceholder")}
                          </dt>
                          <dd className="shrink-0 text-[12px] tabular-nums text-foreground">
                            {formatEuro(Math.max(0, dep.amount || 0), locale)}
                          </dd>
                        </div>
                      ))}
                    </>
                  ) : null}
                </dl>
              )}
            </div>,
            document.body,
          )
        : null}
    </td>
  );
}

function PersonnelRolesSection({
  roles,
  teams,
  companySettings,
  personnelAmount,
  locale,
  view,
  onEdit,
  onDelete,
  onCreate,
  onUpdate,
}: {
  roles: PersonnelRole[];
  teams: PersonnelTeam[];
  companySettings: CompanySettings;
  personnelAmount: number;
  locale: string;
  view: "roles" | "matrix" | "charts";
  onEdit: (role: PersonnelRole) => void;
  onDelete: (role: PersonnelRole) => void;
  onCreate: () => void;
  onUpdate: (role: PersonnelRole) => void;
}) {
  const { t } = useI18n();

  const modelDateMin = monthKeyToStartDate(companySettings.modelStartMonth);
  const modelDateMax = monthKeyToEndDate(companySettings.lastActualMonth);

  const [nameColWidth, setNameColWidth] = useState(() => {
    if (typeof window === "undefined") return 200;
    const raw = window.localStorage.getItem("personnel.sheet.nameColWidth");
    const n = raw ? Number(raw) : NaN;
    if (!Number.isFinite(n)) return 200;
    return Math.min(480, Math.max(120, n));
  });

  function onNameColResizeStart(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = nameColWidth;
    const onMove = (ev: globalThis.MouseEvent) => {
      const next = Math.min(
        480,
        Math.max(120, startWidth + (ev.clientX - startX)),
      );
      setNameColWidth(next);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setNameColWidth((width) => {
        window.localStorage.setItem(
          "personnel.sheet.nameColWidth",
          String(width),
        );
        return width;
      });
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const nameColStyle = {
    width: nameColWidth,
    minWidth: nameColWidth,
    maxWidth: nameColWidth,
  } as const;

  const teamById = useMemo(() => {
    const map = new Map<string, PersonnelTeam>();
    for (const team of teams) map.set(team.id, team);
    return map;
  }, [teams]);

  const grouped = useMemo(() => {
    const sortedTeams = [...teams].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    const byTeam = new Map<string, PersonnelRole[]>();
    const unassigned: PersonnelRole[] = [];
    for (const role of roles) {
      if (role.teamId && teamById.has(role.teamId)) {
        const list = byTeam.get(role.teamId) ?? [];
        list.push(role);
        byTeam.set(role.teamId, list);
      } else {
        unassigned.push(role);
      }
    }
    const groups = sortedTeams
      .map((team) => ({
        key: team.id,
        label: team.name,
        roles: (byTeam.get(team.id) ?? []).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      }))
      .filter((g) => g.roles.length > 0);
    if (unassigned.length > 0) {
      groups.push({
        key: "__none__",
        label: t("personnel.team.unassigned"),
        roles: unassigned.sort((a, b) => a.name.localeCompare(b.name)),
      });
    }
    return groups;
  }, [roles, teams, teamById, t]);

  if (roles.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-line px-4 py-12 text-center">
        <p className="text-[14px] font-medium text-foreground">
          {t("personnel.emptyTitle")}
        </p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">
          {t("personnel.emptyDescription")}
        </p>
        <Button className="mt-4" onClick={onCreate}>
          {t("personnel.emptyCta")}
        </Button>
      </div>
    );
  }

  const costDefaults = personnelDefaultsFromCompany(companySettings);
  const anyScaling = roles.some((r) => r.roleType === "scaling");
  const colCount = anyScaling ? 13 : 10;
  const sortedTeams = [...teams].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const patch = (role: PersonnelRole, partial: Partial<PersonnelRole>) => {
    onUpdate({
      ...role,
      ...partial,
      updatedAt: new Date().toISOString(),
    });
  };

  const fmtPct = (n: number) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const benefitsAnnualDefault = Math.max(0, costDefaults.benefitsMonthly) * 12;

  if (view === "matrix") {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <OverheadKpi
            label={t("personnel.kpi.roles")}
            value={String(roles.length)}
          />
          <OverheadKpi
            label={t("personnel.kpi.period")}
            value={formatEuro(personnelAmount, locale)}
            hint={t("personnel.kpi.periodHint")}
          />
        </div>
        <PersonnelMonthlyMatrix
          roles={roles}
          teams={teams}
          companySettings={companySettings}
        />
      </div>
    );
  }

  if (view === "charts") {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <OverheadKpi
            label={t("personnel.kpi.roles")}
            value={String(roles.length)}
          />
          <OverheadKpi
            label={t("personnel.kpi.period")}
            value={formatEuro(personnelAmount, locale)}
            hint={t("personnel.kpi.periodHint")}
          />
        </div>
        <PersonnelCharts
          roles={roles}
          teams={teams}
          companySettings={companySettings}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <OverheadKpi
          label={t("personnel.kpi.roles")}
          value={String(roles.length)}
        />
        <OverheadKpi
          label={t("personnel.kpi.period")}
          value={formatEuro(personnelAmount, locale)}
          hint={t("personnel.kpi.periodHint")}
        />
      </div>

      <div className="rounded-[10px] border border-line bg-surface-faint/50 px-3 py-2.5 text-[12px]">
        <p className="font-medium text-foreground">
          {t("personnel.defaultsSummaryTitle")}
        </p>
        <p className="mt-1 text-muted">
          {t("personnel.defaultsSummaryLine", {
            nk: fmtPct(costDefaults.lohnnebenkostenPercent),
            benefits: formatEuro(benefitsAnnualDefault, locale),
            zusatz: fmtPct(costDefaults.zusatzAgPercent),
            increase: fmtPct(costDefaults.annualIncreasePercent),
          })}
        </p>
        <p className="mt-1 text-muted">
          {t("personnel.sheetHint")}{" "}
          <Link
            href="/company?tab=personnel"
            className="font-medium text-accent hover:underline"
          >
            {t("company.section.personnel")}
          </Link>
          .
        </p>
      </div>

      <div className="rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full min-w-[960px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-line bg-surface-faint text-[10px] font-semibold uppercase tracking-[0.03em] text-muted-soft">
                <th
                  className="relative sticky left-0 z-10 bg-surface-faint px-3 py-2.5 text-left font-semibold"
                  style={nameColStyle}
                >
                  <span className="pr-2">{t("personnel.col.name")}</span>
                  <button
                    type="button"
                    aria-label={t("personnel.col.resizeName")}
                    title={t("personnel.col.resizeName")}
                    onMouseDown={onNameColResizeStart}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize border-0 bg-transparent p-0 hover:bg-accent/30"
                  />
                </th>
                <th className="px-2 py-2.5 text-right font-semibold">
                  {t("personnel.col.headcount")}
                </th>
                <th className="px-2 py-2.5 font-semibold">
                  {t("personnel.field.team")}
                </th>
                <th className="px-2 py-2.5 font-semibold">
                  {t("personnel.col.roleType")}
                </th>
                <th className="px-2 py-2.5 font-semibold">
                  {t("personnel.col.start")}
                </th>
                <th className="px-2 py-2.5 font-semibold">
                  {t("personnel.col.end")}
                </th>
                <th className="px-2 py-2.5 text-right font-semibold">
                  {t("personnel.col.annualSalary")}
                </th>
                <th className="px-2 py-2.5 text-right font-semibold">
                  {t("personnel.col.monthlyCtc")}
                </th>
                <th className="px-2 py-2.5 text-right font-semibold">
                  {t("personnel.col.packagesMonthly")}
                </th>
                {anyScaling ? (
                  <th
                    colSpan={3}
                    className="border-l border-line px-2 py-2.5 text-center font-semibold"
                  >
                    {t("personnel.col.teamScaling")}
                  </th>
                ) : null}
                <th className="px-2 py-2.5 text-right font-semibold">
                  <span className="sr-only">{t("common.edit")}</span>
                </th>
              </tr>
              {anyScaling ? (
                <tr className="border-b border-line bg-surface-faint text-[10px] font-medium text-muted">
                  <th
                    className="sticky left-0 z-10 bg-surface-faint px-3 py-1.5"
                    style={nameColStyle}
                  />
                  <th className="px-2 py-1.5" />
                  <th className="px-2 py-1.5" />
                  <th className="px-2 py-1.5" />
                  <th className="px-2 py-1.5" />
                  <th className="px-2 py-1.5" />
                  <th className="px-2 py-1.5" />
                  <th className="px-2 py-1.5" />
                  <th className="px-2 py-1.5" />
                  <th className="border-l border-line px-2 py-1.5 text-center font-medium">
                    {t("personnel.col.hiresPerPeriod")}
                  </th>
                  <th className="px-2 py-1.5 text-center font-medium">
                    {t("personnel.col.hireFrequency")}
                  </th>
                  <th className="px-2 py-1.5 text-center font-medium">
                    {t("personnel.col.maxHeadcount")}
                  </th>
                  <th className="px-2 py-1.5" />
                </tr>
              ) : null}
            </thead>
            <tbody>
              {grouped.map((group) => (
                <Fragment key={group.key}>
                  <tr className="border-b border-line bg-surface-soft">
                    <td
                      colSpan={colCount}
                      className="sticky left-0 px-3 py-2 text-[12px] font-semibold text-foreground"
                    >
                      {group.label}
                    </td>
                  </tr>
                  {group.roles.map((role) => {
                    const priced = withCompanyPersonnelDefaults(
                      role,
                      costDefaults,
                    );
                    const annual = annualSalary(priced);
                    const isScaling = role.roleType === "scaling";
                    return (
                      <tr
                        key={role.id}
                        className="border-b border-line last:border-0 hover:bg-surface-faint"
                      >
                        <td
                          className="sticky left-0 z-[1] bg-white px-3 py-2 hover:bg-surface-faint"
                          style={nameColStyle}
                        >
                          <SheetText
                            value={role.name}
                            placeholder={t("personnel.field.namePlaceholder")}
                            className="!w-full"
                            onCommit={(name) => {
                              if (!name) return;
                              patch(role, { name });
                            }}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <SheetNum
                            value={role.headcount}
                            locale={locale}
                            widthClass="!w-[5.5rem]"
                            className="justify-end"
                            onCommit={(n) =>
                              patch(role, {
                                headcount: Math.max(0, Math.round(n * 2) / 2),
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <SheetSelect
                            value={role.teamId}
                            className="w-[7.25rem] min-w-0"
                            title={t("personnel.field.team")}
                            onChange={(teamId) => patch(role, { teamId })}
                          >
                            <option value="">
                              {t("personnel.team.unassigned")}
                            </option>
                            {sortedTeams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </SheetSelect>
                        </td>
                        <td className="px-2 py-2">
                          <SheetSelect
                            value={role.roleType}
                            className="!w-[9.5rem] min-w-[9.5rem]"
                            title={t("personnel.col.roleType")}
                            onChange={(roleType) =>
                              patch(role, {
                                roleType: roleType as PersonnelRoleType,
                              })
                            }
                          >
                            {PERSONNEL_ROLE_TYPES.map((rt) => (
                              <option key={rt} value={rt}>
                                {t(`personnel.roleType.${rt}` as MessageKey)}
                              </option>
                            ))}
                          </SheetSelect>
                        </td>
                        <td className="px-2 py-2">
                          <SheetDate
                            value={role.gueltigVon}
                            min={modelDateMin}
                            max={earlierIsoDate(role.gueltigBis, modelDateMax)}
                            onCommit={(gueltigVon) =>
                              patch(role, { gueltigVon })
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <SheetDate
                            value={role.gueltigBis}
                            min={laterIsoDate(role.gueltigVon, modelDateMin)}
                            max={modelDateMax}
                            onCommit={(gueltigBis) =>
                              patch(role, { gueltigBis })
                            }
                          />
                        </td>
                        <td className="px-2 py-2">
                          <SheetNum
                            value={annual}
                            locale={locale}
                            widthClass="!w-[6.5rem]"
                            onCommit={(n) =>
                              patch(role, { bruttoGehalt: n / 12 })
                            }
                          />
                        </td>
                        <CtcBreakdownCell role={priced} locale={locale} />
                        <PackagesBreakdownCell role={priced} locale={locale} />
                        {anyScaling ? (
                          <>
                            <td className="border-l border-line px-2 py-2 text-center">
                              {isScaling ? (
                                <SheetNum
                                  value={role.hiresPerPeriod}
                                  locale={locale}
                                  className="justify-center"
                                  onCommit={(n) =>
                                    patch(role, {
                                      hiresPerPeriod: Math.max(
                                        1,
                                        Math.round(n),
                                      ),
                                    })
                                  }
                                />
                              ) : (
                                <span className="text-muted">
                                  {t("common.emDash")}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center">
                              {isScaling ? (
                                <SheetSelect
                                  value={role.hireFrequency}
                                  className="!w-[9.25rem] min-w-[9.25rem]"
                                  title={t("personnel.col.hireFrequency")}
                                  onChange={(hireFrequency) =>
                                    patch(role, {
                                      hireFrequency:
                                        hireFrequency as PersonnelHireFrequency,
                                    })
                                  }
                                >
                                  {PERSONNEL_HIRE_FREQUENCIES.map((f) => (
                                    <option key={f} value={f}>
                                      {t(
                                        `personnel.hireFrequency.${f}` as MessageKey,
                                      )}
                                    </option>
                                  ))}
                                </SheetSelect>
                              ) : (
                                <span className="text-muted">
                                  {t("common.emDash")}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center">
                              {isScaling ? (
                                <SheetNum
                                  value={role.maxHeadcount ?? 0}
                                  locale={locale}
                                  className="justify-center"
                                  onCommit={(n) =>
                                    patch(role, {
                                      maxHeadcount:
                                        n <= 0 ? null : Math.round(n),
                                    })
                                  }
                                />
                              ) : (
                                <span className="text-muted">
                                  {t("common.emDash")}
                                </span>
                              )}
                            </td>
                          </>
                        ) : null}
                        <td className="px-2 py-2">
                          <TableRowActions
                            onEdit={() => onEdit(role)}
                            onDelete={() => onDelete(role)}
                            editLabel={t("common.edit")}
                            deleteLabel={t("common.delete")}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
