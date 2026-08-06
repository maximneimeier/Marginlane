"use client";

import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import {
  defaultOverviewRange,
  rangeForPreset,
  type DatePreset,
  type DateRange,
} from "@/lib/overview";
import { useI18n } from "@/hooks/useI18n";
import { OverviewOverheadPanel } from "@/components/OverviewOverheadPanel";
import { Card, Field, PageHeader, Select, TextInput } from "@/components/ui";

export default function OverheadPageClient() {
  const { ready, data } = useStore();
  const { t } = useI18n();
  const [preset, setPreset] = useState<DatePreset>("this_year");
  const [range, setRange] = useState<DateRange>(() => defaultOverviewRange());

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("overhead.title")}
        description={t("overhead.description")}
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
          <p className="shrink-0 text-[12px] text-muted lg:pb-2">
            {t("overhead.itemCount", { count: data.overheadItems.length })}
          </p>
        </div>
      </Card>

      <OverviewOverheadPanel range={range} hidePageHeader />
    </div>
  );
}
