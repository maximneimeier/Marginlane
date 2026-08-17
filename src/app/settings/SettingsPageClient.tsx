"use client";

import { useState } from "react";
import { usePrefs, type AppLanguage } from "@/context/PreferencesContext";
import { useStore } from "@/context/StoreContext";
import { useI18n } from "@/hooks/useI18n";
import {
  buildBatchesCsv,
  buildComponentsCsv,
  buildProductsCsv,
  buildSuppliersCsv,
  downloadCsv,
} from "@/lib/exportCsv";
import {
  importComponentsCsv,
  importProductsCsv,
  importSuppliersCsv,
} from "@/lib/importMasterData";
import { NUMBER_FORMAT_STYLES, type NumberFormatStyle } from "@/lib/types";
import { MarginPackageExportButtons } from "@/components/MarginPackageExportButtons";
import { Button, Card, Field, PageHeader, Select, TextInput } from "@/components/ui";

export default function EinstellungenPage() {
  const { ready, prefs, setPrefs } = usePrefs();
  const { ready: storeReady, data, replaceAppData } = useStore();
  const { t } = useI18n();
  const [importMsg, setImportMsg] = useState<string | null>(null);

  if (!ready || !storeReady) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  const stamp = new Date().toISOString().slice(0, 10);

  async function handleImport(
    kind: "suppliers" | "products" | "components",
    file: File,
  ) {
    const text = await file.text();
    let next = data;
    let upserted = 0;
    let errors: string[] = [];
    if (kind === "suppliers") {
      const r = importSuppliersCsv(text, next);
      next = r.data;
      upserted = r.upserted;
      errors = r.errors;
    } else if (kind === "products") {
      const r = importProductsCsv(text, next);
      next = r.data;
      upserted = r.upserted;
      errors = r.errors;
    } else {
      const r = importComponentsCsv(text, next);
      next = r.data;
      upserted = r.upserted;
      errors = r.errors;
    }
    if (upserted > 0) replaceAppData(next);
    setImportMsg(
      t("settings.import.result", {
        count: String(upserted),
        errors: String(errors.length),
      }),
    );
  }

  return (
    <div>
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <div className="space-y-4">
        <Card>
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
            {t("settings.profile")}
          </h2>
          <p className="mb-4 text-[13px] text-muted">{t("settings.profileHint")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("settings.displayName")}>
              <TextInput
                value={prefs.displayName}
                onChange={(e) => setPrefs({ displayName: e.target.value })}
                placeholder={t("settings.displayNamePlaceholder")}
              />
            </Field>
            <Field label={t("settings.email")}>
              <TextInput
                type="email"
                value={prefs.email}
                onChange={(e) => setPrefs({ email: e.target.value })}
                placeholder="name@firma.de"
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
            {t("settings.language")}
          </h2>
          <p className="mb-4 text-[13px] text-muted">
            {t("settings.languageHint")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("settings.appLanguage")}>
              <Select
                value={prefs.language}
                onChange={(e) =>
                  setPrefs({ language: e.target.value as AppLanguage })
                }
              >
                <option value="de">{t("settings.lang.de")}</option>
                <option value="en">{t("settings.lang.en")}</option>
              </Select>
            </Field>
            <Field
              label={t("settings.numberFormat")}
              hint={t("settings.numberFormatHint")}
            >
              <Select
                value={prefs.numberFormat}
                onChange={(e) =>
                  setPrefs({
                    numberFormat: e.target.value as NumberFormatStyle,
                  })
                }
              >
                {NUMBER_FORMAT_STYLES.map((style) => (
                  <option key={style} value={style}>
                    {t(`settings.numberFormat.${style}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="mt-3 text-[12px] text-muted-soft">
            {t("settings.savedLocally")}
          </p>
        </Card>

        <Card>
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
            {t("settings.export.title")}
          </h2>
          <p className="mb-4 text-[13px] text-muted">
            {t("settings.export.hint")}
          </p>
          <div className="mb-4 rounded-[8px] border border-line bg-surface-faint p-3">
            <p className="mb-2 text-[13px] font-medium text-foreground">
              {t("settings.export.marginPackage")}
            </p>
            <p className="mb-3 text-[12px] text-muted">
              {t("settings.export.marginPackageHint")}
            </p>
            <MarginPackageExportButtons data={data} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  `marginlane_suppliers_${stamp}.csv`,
                  buildSuppliersCsv(data),
                )
              }
            >
              {t("settings.export.suppliers")}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  `marginlane_products_${stamp}.csv`,
                  buildProductsCsv(data),
                )
              }
            >
              {t("settings.export.products")}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  `marginlane_components_${stamp}.csv`,
                  buildComponentsCsv(data),
                )
              }
            >
              {t("settings.export.components")}
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                downloadCsv(
                  `marginlane_batches_${stamp}.csv`,
                  buildBatchesCsv(data),
                )
              }
            >
              {t("settings.export.batches")}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-[15px] font-semibold tracking-tight">
            {t("settings.import.title")}
          </h2>
          <p className="mb-4 text-[13px] text-muted">
            {t("settings.import.hint")}
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["suppliers", "settings.import.suppliers"],
                ["products", "settings.import.products"],
                ["components", "settings.import.components"],
              ] as const
            ).map(([kind, labelKey]) => (
              <label
                key={kind}
                className="inline-flex h-8 cursor-pointer items-center rounded-[8px] border border-line px-3 text-[13px] font-medium text-foreground hover:bg-surface-faint"
              >
                {t(labelKey)}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void handleImport(kind, file);
                  }}
                />
              </label>
            ))}
          </div>
          {importMsg ? (
            <p className="mt-3 text-[12px] text-muted">{importMsg}</p>
          ) : null}
        </Card>

        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={() =>
              setPrefs({
                displayName: "Maxim Neimeier",
                email: "account@maximneimeier.de",
                language: "de",
                numberFormat: "de",
              })
            }
          >
            {t("common.resetDefaults")}
          </Button>
        </div>
      </div>
    </div>
  );
}
