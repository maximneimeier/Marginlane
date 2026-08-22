"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { CostItemEditor } from "@/components/CostItemEditor";
import {
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui";
import { createId, formatEuro, formatNumber } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import {
  checkProductionStock,
  emptyProductionRun,
  estimateProductionRun,
  manufacturingCostItemsFromRouting,
  productionInputsFromBom,
} from "@/lib/production";
import type { CostItem, ProductionRunInput } from "@/lib/types";
import { PRODUCTION_COST_PHASES } from "@/lib/types";
import { CosterraWholesaleRedirect } from "@/components/CosterraWholesaleRedirect";
import { usePrefs } from "@/context/PreferencesContext";
import { isCosterraWholesale } from "@/lib/costerraMode";

export default function NewProductionPageClient() {
  const { ready: prefsReady, prefs } = usePrefs();
  if (!prefsReady) {
    return <p className="px-4 py-8 text-sm text-muted">…</p>;
  }
  if (isCosterraWholesale(prefs)) {
    return <CosterraWholesaleRedirect />;
  }
  return <NewProductionPageInner />;
}

function NewProductionPageInner() {
  const router = useRouter();
  const { ready, data, saveProductionRun } = useStore();
  const { t, locale, pricingUnitLabel } = useI18n();

  const [label, setLabel] = useState("");
  const [productId, setProductId] = useState("");
  const [outputQuantity, setOutputQuantity] = useState(100);
  const [scrapPercent, setScrapPercent] = useState(0);
  const [inputs, setInputs] = useState<ProductionRunInput[]>([]);
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [notes, setNotes] = useState("");
  const [completeOnSave, setCompleteOnSave] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [costsFromRouting, setCostsFromRouting] = useState(false);

  const products = useMemo(
    () =>
      [...data.catalogProducts]
        .filter((p) => p.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [data.catalogProducts, locale],
  );

  const product = data.catalogProducts.find((p) => p.id === productId);
  const routingSteps = product?.routingSteps ?? [];

  useEffect(() => {
    if (!productId) {
      setInputs([]);
      setCostItems([]);
      setCostsFromRouting(false);
      return;
    }
    setInputs(productionInputsFromBom(data, productId));
    const steps =
      data.catalogProducts.find((p) => p.id === productId)?.routingSteps ?? [];
    if (steps.length > 0) {
      setCostItems(manufacturingCostItemsFromRouting(steps, outputQuantity));
      setCostsFromRouting(true);
    } else {
      setCostItems([]);
      setCostsFromRouting(false);
    }
    // outputQuantity absichtlich nicht in deps — Losgröße aktualisiert Rüst-Umlage separat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, data.productComponents, data.catalogProducts]);

  useEffect(() => {
    if (!costsFromRouting || !productId) return;
    const steps =
      data.catalogProducts.find((p) => p.id === productId)?.routingSteps ?? [];
    if (steps.length === 0) return;
    setCostItems(manufacturingCostItemsFromRouting(steps, outputQuantity));
  }, [outputQuantity, costsFromRouting, productId, data.catalogProducts]);

  const draft = useMemo(
    () =>
      emptyProductionRun({
        label,
        outputProductId: productId,
        outputQuantity,
        scrapRate: Math.max(scrapPercent, 0) / 100,
        inputs,
        costItems,
        notes,
      }),
    [label, productId, outputQuantity, scrapPercent, inputs, costItems, notes],
  );

  const estimate = useMemo(
    () => estimateProductionRun(data, draft),
    [data, draft],
  );

  const stock = useMemo(
    () => checkProductionStock(data, draft),
    [data, draft],
  );

  function updateInput(id: string, patch: Partial<ProductionRunInput>) {
    setInputs((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function addInput() {
    const first = data.components[0];
    setInputs((prev) => [
      ...prev,
      {
        id: createId("pri"),
        componentId: first?.id ?? "",
        quantityPerOutput: 1,
        unitCostOverride: null,
      },
    ]);
  }

  function removeInput(id: string) {
    setInputs((prev) => prev.filter((row) => row.id !== id));
  }

  function save() {
    if (!productId || outputQuantity <= 0) return;
    setSaveError("");
    if (completeOnSave && stock.hasShortfall) {
      setSaveError(t("production.stock.blockComplete"));
      return;
    }
    const run = emptyProductionRun({
      label: label.trim(),
      outputProductId: productId,
      outputQuantity,
      scrapRate: Math.max(scrapPercent, 0) / 100,
      inputs,
      costItems,
      notes,
    });
    const batchId = saveProductionRun(run, { complete: completeOnSave });
    if (completeOnSave && !batchId) {
      setSaveError(t("production.stock.blockComplete"));
      return;
    }
    router.push("/production");
  }

  if (!ready) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }

  return (
    <div>
      <PageHeader
        title={t("production.new.title")}
        description={t("production.new.description")}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <Field label={t("production.field.label")}>
              <TextInput
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("production.field.labelPlaceholder")}
              />
            </Field>
            <Field label={t("production.field.product")} required>
              <Select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">{t("production.field.productPlaceholder")}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("production.field.qty")} required>
                <TextInput
                  type="number"
                  min={0}
                  value={outputQuantity}
                  onChange={(e) =>
                    setOutputQuantity(Math.max(Number(e.target.value) || 0, 0))
                  }
                />
              </Field>
              <Field label={t("production.field.scrap")}>
                <TextInput
                  type="number"
                  min={0}
                  max={95}
                  step={0.1}
                  value={scrapPercent}
                  onChange={(e) =>
                    setScrapPercent(Math.max(Number(e.target.value) || 0, 0))
                  }
                />
              </Field>
            </div>
            <Field label={t("production.field.notes")}>
              <TextArea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </Field>
          </Card>

          <Card className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[14px] font-medium">
                  {t("production.inputs.title")}
                </h2>
                <p className="text-[12px] text-muted">
                  {t("production.inputs.hint")}
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  {t("production.inputs.costBasisHint", {
                    rule: t(
                      data.companySettings.productionCostBasis === "last_landed"
                        ? "costBasis.last_landed"
                        : data.companySettings.productionCostBasis ===
                            "fifo_stock"
                          ? "costBasis.fifo_stock"
                          : "costBasis.list",
                    ),
                  })}
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={addInput}>
                {t("production.inputs.add")}
              </Button>
            </div>

            {inputs.length === 0 ? (
              <p className="text-sm text-muted">{t("production.inputs.empty")}</p>
            ) : (
              <div className="space-y-2">
                {inputs.map((row) => {
                  const line = estimate.inputTotals.find(
                    (x) => x.input.id === row.id,
                  );
                  return (
                    <div
                      key={row.id}
                      className="grid gap-2 rounded-[8px] border border-line p-2 sm:grid-cols-[1.4fr_0.7fr_0.7fr_auto]"
                    >
                      <Select
                        value={row.componentId}
                        onChange={(e) =>
                          updateInput(row.id, { componentId: e.target.value })
                        }
                      >
                        <option value="">—</option>
                        {data.components.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                      <TextInput
                        type="number"
                        min={0}
                        step="any"
                        value={row.quantityPerOutput}
                        onChange={(e) =>
                          updateInput(row.id, {
                            quantityPerOutput: Math.max(
                              Number(e.target.value) || 0,
                              0,
                            ),
                          })
                        }
                        aria-label={t("production.inputs.qtyPer")}
                      />
                      <TextInput
                        type="number"
                        min={0}
                        step="any"
                        value={row.unitCostOverride ?? ""}
                        placeholder={t("production.inputs.costAuto")}
                        onChange={(e) => {
                          const raw = e.target.value;
                          updateInput(row.id, {
                            unitCostOverride:
                              raw === "" ? null : Math.max(Number(raw) || 0, 0),
                          });
                        }}
                        aria-label={t("production.inputs.unitCost")}
                      />
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <span className="text-[12px] tabular-nums text-muted">
                          {formatEuro(line?.lineTotal ?? 0, locale)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-[12px]"
                          onClick={() => removeInput(row.id)}
                        >
                          {t("common.delete")}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-4">
            {costsFromRouting && routingSteps.length > 0 ? (
              <p className="mb-3 text-[12px] text-muted">
                {t("production.costs.fromRouting", {
                  count: String(routingSteps.length),
                })}
              </p>
            ) : null}
            <CostItemEditor
              items={costItems}
              onChange={(next) => {
                setCostsFromRouting(false);
                setCostItems(next);
              }}
              allowedPhases={PRODUCTION_COST_PHASES}
              title={t("production.costs.title")}
              unitLabel={pricingUnitLabel(product?.pricingUnit ?? "pcs")}
            />
          </Card>
        </div>

        <aside className="space-y-3">
          <Card className="space-y-2 p-4">
            <h2 className="text-[14px] font-medium">
              {t("production.estimate.title")}
            </h2>
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">{t("production.estimate.material")}</dt>
                <dd className="tabular-nums">
                  {formatEuro(estimate.materialTotal, locale)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">{t("production.estimate.mfg")}</dt>
                <dd className="tabular-nums">
                  {formatEuro(estimate.manufacturingTotal, locale)}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-line pt-1.5 font-medium">
                <dt>{t("production.estimate.unit")}</dt>
                <dd className="tabular-nums">
                  {formatEuro(estimate.unitCost, locale)}
                </dd>
              </div>
              <p className="text-[11px] text-muted-soft">
                {t("production.estimate.qtyHint", {
                  qty: formatNumber(estimate.outputQuantity, locale),
                  unit: pricingUnitLabel(product?.pricingUnit ?? "pcs"),
                })}
              </p>
            </dl>
          </Card>

          <Card className="space-y-2 p-4">
            <h2 className="text-[14px] font-medium">
              {t("production.stock.title")}
            </h2>
            {stock.lines.length === 0 ? (
              <p className="text-[12px] text-muted">
                {t("production.stock.empty")}
              </p>
            ) : (
              <ul className="space-y-2 text-[12px]">
                {stock.lines.map((line) => (
                  <li
                    key={line.componentId}
                    className="rounded-[8px] border border-line px-2 py-1.5"
                  >
                    <p className="font-medium text-foreground">
                      {line.component?.name ?? line.componentId}
                    </p>
                    {!line.tracked ? (
                      <p className="text-muted-soft">
                        {t("production.stock.untrackedHint")}
                      </p>
                    ) : (
                      <p className="tabular-nums text-muted">
                        {t("production.stock.line", {
                          need: formatNumber(line.needed, locale),
                          free: formatNumber(line.free, locale),
                          onHand: formatNumber(line.onHand, locale),
                          reserved: formatNumber(line.reserved, locale),
                        })}
                      </p>
                    )}
                    {line.shortfall > 0 ? (
                      <p className="text-danger">
                        {t("production.stock.shortBy", {
                          qty: formatNumber(line.shortfall, locale),
                        })}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <label className="flex items-start gap-2 rounded-[8px] border border-line bg-white px-3 py-2 text-[13px]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={completeOnSave}
              onChange={(e) => setCompleteOnSave(e.target.checked)}
            />
            <span>{t("production.new.completeOnSave")}</span>
          </label>

          {saveError ? (
            <p className="text-[12px] text-danger">{saveError}</p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={
                !productId ||
                outputQuantity <= 0 ||
                (completeOnSave && stock.hasShortfall)
              }
              onClick={save}
            >
              {completeOnSave
                ? t("production.new.saveAndComplete")
                : t("production.new.saveDraft")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/production")}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
