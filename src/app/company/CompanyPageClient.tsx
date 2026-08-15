"use client";

import { useStore } from "@/context/StoreContext";
import { useI18n } from "@/hooks/useI18n";
import {
  CURRENCIES,
  EMPTY_COMPANY_SETTINGS,
  VAT_FILING_CADENCES,
  type CompanySettings,
  type VatFilingCadence,
} from "@/lib/types";
import { Card, Field, PageHeader, Select, TextInput } from "@/components/ui";

function parseNumberInput(raw: string): number {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseOptionalNumberInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default function CompanyPageClient() {
  const { ready, data, patchCompanySettings } = useStore();
  const { t } = useI18n();

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  const settings: CompanySettings = {
    ...EMPTY_COMPANY_SETTINGS,
    ...(data.companySettings ?? {}),
  };

  const patch = (partial: Partial<CompanySettings>) => {
    patchCompanySettings(partial);
  };

  return (
    <div>
      <PageHeader
        title={t("company.title")}
        description={t("company.description")}
      />

      <div className="space-y-4">
        <Card>
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
            {t("company.section.general")}
          </h2>
          <p className="mb-4 text-[13px] text-muted">
            {t("company.section.generalHint")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("company.field.companyName")}>
              <TextInput
                value={settings.companyName}
                onChange={(e) => patch({ companyName: e.target.value })}
                placeholder={t("company.field.companyNamePlaceholder")}
              />
            </Field>
            <Field label={t("company.field.baseCurrency")}>
              <Select
                value={settings.baseCurrency}
                onChange={(e) => patch({ baseCurrency: e.target.value })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("company.field.modelStartMonth")}
              hint={t("company.field.monthHint")}
            >
              <TextInput
                type="month"
                value={settings.modelStartMonth}
                onChange={(e) => patch({ modelStartMonth: e.target.value })}
              />
            </Field>
            <Field
              label={t("company.field.lastActualMonth")}
              hint={t("company.field.monthHint")}
            >
              <TextInput
                type="month"
                value={settings.lastActualMonth}
                onChange={(e) => patch({ lastActualMonth: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
            {t("company.section.starting")}
          </h2>
          <p className="mb-4 text-[13px] text-muted">
            {t("company.section.startingHint")}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("company.field.startingEquity")}>
              <TextInput
                type="number"
                step="any"
                value={settings.startingEquity}
                onChange={(e) =>
                  patch({ startingEquity: parseNumberInput(e.target.value) })
                }
              />
            </Field>
            <Field label={t("company.field.startingCash")}>
              <TextInput
                type="number"
                step="any"
                value={settings.startingCash}
                onChange={(e) =>
                  patch({ startingCash: parseNumberInput(e.target.value) })
                }
              />
            </Field>
            <Field label={t("company.field.unpaidTaxesAtStart")}>
              <TextInput
                type="number"
                step="any"
                value={settings.unpaidTaxesAtStart}
                onChange={(e) =>
                  patch({
                    unpaidTaxesAtStart: parseNumberInput(e.target.value),
                  })
                }
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
            {t("company.section.taxes")}
          </h2>
          <p className="mb-4 text-[13px] text-muted">
            {t("company.section.taxesHint")}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label={t("company.field.kst")}
              hint={t("company.field.kstHint")}
            >
              <TextInput
                type="number"
                step="any"
                value={settings.koerperschaftsteuerPercent}
                onChange={(e) =>
                  patch({
                    koerperschaftsteuerPercent: parseNumberInput(
                      e.target.value,
                    ),
                  })
                }
              />
            </Field>
            <Field
              label={t("company.field.soli")}
              hint={t("company.field.soliHint")}
            >
              <TextInput
                type="number"
                step="any"
                value={settings.solidaritaetszuschlagPercent}
                onChange={(e) =>
                  patch({
                    solidaritaetszuschlagPercent: parseNumberInput(
                      e.target.value,
                    ),
                  })
                }
              />
            </Field>
            <Field
              label={t("company.field.gewst")}
              hint={t("company.field.gewstHint")}
            >
              <TextInput
                type="number"
                step="any"
                value={settings.gewerbesteuerPercent}
                onChange={(e) =>
                  patch({
                    gewerbesteuerPercent: parseNumberInput(e.target.value),
                  })
                }
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
            {t("company.section.vat")}
          </h2>
          <p className="mb-4 text-[13px] text-muted">
            {t("company.section.vatHint")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("company.field.vatRate")}>
              <TextInput
                type="number"
                step="any"
                value={settings.vatRatePercent}
                onChange={(e) =>
                  patch({ vatRatePercent: parseNumberInput(e.target.value) })
                }
              />
            </Field>
            <Field label={t("company.field.vatCadence")}>
              <Select
                value={settings.vatFilingCadence}
                onChange={(e) =>
                  patch({
                    vatFilingCadence: e.target.value as VatFilingCadence,
                  })
                }
              >
                {VAT_FILING_CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {t(`company.vatCadence.${c}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
            {t("company.section.personnel")}
          </h2>
          <p className="mb-4 text-[13px] text-muted">
            {t("company.section.personnelHint")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("company.field.defaultNk")}>
              <TextInput
                type="number"
                step="any"
                value={settings.defaultLohnnebenkostenPercent}
                onChange={(e) =>
                  patch({
                    defaultLohnnebenkostenPercent: parseNumberInput(
                      e.target.value,
                    ),
                  })
                }
              />
            </Field>
            <Field label={t("company.field.defaultZusatz")}>
              <TextInput
                type="number"
                step="any"
                value={settings.defaultZusatzAgPercent}
                onChange={(e) =>
                  patch({
                    defaultZusatzAgPercent: parseNumberInput(e.target.value),
                  })
                }
              />
            </Field>
            <Field label={t("company.field.defaultBenefits")}>
              <TextInput
                type="number"
                step="any"
                value={settings.defaultBenefitsMonthly}
                onChange={(e) =>
                  patch({
                    defaultBenefitsMonthly: parseNumberInput(e.target.value),
                  })
                }
              />
            </Field>
            <Field label={t("company.field.defaultIncrease")}>
              <TextInput
                type="number"
                step="any"
                value={settings.defaultAnnualIncreasePercent}
                onChange={(e) =>
                  patch({
                    defaultAnnualIncreasePercent: parseNumberInput(
                      e.target.value,
                    ),
                  })
                }
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
            {t("company.section.valuation")}
          </h2>
          <p className="mb-4 text-[13px] text-muted">
            {t("company.section.valuationHint")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("company.field.wacc")}>
              <TextInput
                type="number"
                step="any"
                value={settings.waccPercent ?? ""}
                placeholder={t("common.emDash")}
                onChange={(e) =>
                  patch({
                    waccPercent: parseOptionalNumberInput(e.target.value),
                  })
                }
              />
            </Field>
            <Field label={t("company.field.terminalGrowth")}>
              <TextInput
                type="number"
                step="any"
                value={settings.terminalGrowthPercent ?? ""}
                placeholder={t("common.emDash")}
                onChange={(e) =>
                  patch({
                    terminalGrowthPercent: parseOptionalNumberInput(
                      e.target.value,
                    ),
                  })
                }
              />
            </Field>
          </div>
        </Card>

        <p className="text-[12px] text-muted-soft">{t("company.savedHint")}</p>
      </div>
    </div>
  );
}
