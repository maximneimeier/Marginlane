"use client";

import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import {
  defaultOverviewRange,
  rangeForPreset,
  type DatePreset,
  type DateRange,
} from "@/lib/overview";
import {
  buildOverheadPeriodCsv,
  downloadOverheadCsv,
} from "@/lib/overhead";
import { FEATURES } from "@/lib/features";
import { useI18n } from "@/hooks/useI18n";
import type { MessageKey } from "@/lib/i18n";
import { usePrefs } from "@/context/PreferencesContext";
import { isCosterraAppModule } from "@/lib/costerraMode";
import { OverviewOverheadPanel } from "@/components/OverviewOverheadPanel";
import { OverheadRunRateStrip } from "@/components/OverheadRunRateStrip";
import {
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextInput,
} from "@/components/ui";

type Props = {
  section: "positions" | "personnel";
};

export default function OverheadPageClient({ section }: Props) {
  const { ready, data } = useStore();
  const { prefs } = usePrefs();
  const { t } = useI18n();
  const [preset, setPreset] = useState<DatePreset>("this_year");
  const [range, setRange] = useState<DateRange>(() => defaultOverviewRange());
  const costerraSimple = isCosterraAppModule(prefs.activeModule);

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

  function exportCsv() {
    const csv = buildOverheadPeriodCsv(data, range, {
      sectionMeta: t("overhead.export.section.meta"),
      sectionPositions: t("overhead.export.section.positions"),
      sectionCategory: t("overhead.export.section.category"),
      sectionProducts: t("overhead.export.section.products"),
      sectionActuals: t("overhead.export.section.actuals"),
      rangeFrom: t("overviewPage.from"),
      rangeTo: t("overviewPage.to"),
      exportedAt: t("overhead.export.exportedAt"),
      name: t("overhead.col.name"),
      amount: t("overhead.col.betrag"),
      currency: t("overhead.field.waehrung"),
      period: t("overhead.col.periode"),
      category: t("overhead.col.kategorie"),
      costBehavior: t("overhead.col.kostenart"),
      allocation: t("overhead.col.verteilschluessel"),
      periodAmount: t("overhead.col.periodAmount"),
      validFrom: t("overhead.field.gueltigVon"),
      validTo: t("overhead.field.gueltigBis"),
      createdAt: t("overhead.export.createdAt"),
      updatedAt: t("overhead.export.updatedAt"),
      updatedBy: t("overhead.export.updatedBy"),
      plan: t("overhead.planVsActual.plan"),
      actual: t("overhead.planVsActual.actual"),
      delta: t("overhead.planVsActual.delta"),
      product: t("overhead.distribution.product"),
      overhead: t("overhead.distribution.overhead"),
      db3: t("overhead.distribution.db3"),
      after: t("overhead.distribution.after"),
      month: t("overhead.planVsActual.month"),
      labelCategory: (k) => t(`overhead.category.${k}` as MessageKey),
      labelPeriod: (p) => t(`overhead.period.${p}` as MessageKey),
      labelCostBehavior: (c) => t(`overhead.costBehavior.${c}` as MessageKey),
      labelAllocation: (a) => t(`overhead.allocation.${a}` as MessageKey),
    });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadOverheadCsv(
      `gemeinkosten_${range.from}_${range.to}_${stamp}.csv`,
      csv,
    );
  }

  const isPersonnel = section === "personnel";

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          isPersonnel
            ? costerraSimple
              ? t("personnel.page.titleSimple")
              : t("personnel.page.title")
            : costerraSimple
              ? t("overhead.positionsPage.titleSimple")
              : t("overhead.positionsPage.title")
        }
        description={
          isPersonnel
            ? costerraSimple
              ? t("personnel.page.descriptionSimple")
              : t("personnel.page.description")
            : costerraSimple
              ? t("overhead.positionsPage.descriptionSimple")
              : t("overhead.positionsPage.description")
        }
        action={
          !isPersonnel && FEATURES.overheadCsvExport && !costerraSimple ? (
            <Button variant="secondary" onClick={exportCsv}>
              {t("overhead.export.csv")}
            </Button>
          ) : undefined
        }
      />

      {!isPersonnel ? (
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
                  <option value="custom">
                    {t("overviewPage.preset.custom")}
                  </option>
                </Select>
              </Field>
            </div>
            <p className="shrink-0 text-[12px] text-muted lg:pb-2">
              {t("overhead.itemCount", { count: data.overheadItems.length })}
            </p>
          </div>
          {FEATURES.overheadRunRate ? (
            <OverheadRunRateStrip
              items={data.overheadItems}
              range={range}
              data={data}
            />
          ) : null}
        </Card>
      ) : null}

      <OverviewOverheadPanel
        range={range}
        hidePageHeader
        section={section}
        simpleMode={costerraSimple}
      />
    </div>
  );
}
