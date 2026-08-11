"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import type { CostItem, Dealer } from "@/lib/types";
import {
  calculateUnitEconomics,
} from "@/lib/calc";
import { catalogProductUnitPurchaseCost } from "@/lib/migrateAppData";
import { formatEuro, formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import {
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextInput,
} from "@/components/ui";

type Scenario = {
  productId: string;
  dealerId: string;
  quantity: number;
  freight: number;
  dutyPercent: number;
  otherLump: number;
  /** Manueller VK; leer/0 mit Händler = Händler-Default */
  sellPrice: number;
  /** Fallback-Vertriebsgebühr %, wenn kein Händler */
  salesFeePercent: number;
};

const emptyScenario = (): Scenario => ({
  productId: "",
  dealerId: "",
  quantity: 1000,
  freight: 400,
  dutyPercent: 5,
  otherLump: 0,
  sellPrice: 0,
  salesFeePercent: 15,
});

function procurementItems(scenario: Scenario): CostItem[] {
  return (
    [
      {
        id: "freight",
        type: "Fracht",
        label: "Fracht",
        amount: scenario.freight,
        allocation: "lump_sum" as const,
        phase: "transport" as const,
      },
      {
        id: "duty",
        type: "Zoll",
        label: "Zoll",
        amount: scenario.dutyPercent,
        allocation: "percent_of_goods" as const,
        phase: "einkauf" as const,
      },
      {
        id: "other",
        type: "Sonstiges",
        label: "Sonstiges",
        amount: scenario.otherLump,
        allocation: "lump_sum" as const,
        phase: "einkauf" as const,
      },
    ] satisfies CostItem[]
  ).filter((i) => i.amount > 0);
}

function salesItemsFor(
  scenario: Scenario,
  dealer: Dealer | undefined,
): CostItem[] {
  if (dealer) {
    return dealer.salesCostItems;
  }
  if (scenario.salesFeePercent <= 0) return [];
  return [
    {
      id: "fee",
      type: "Plattformgebühr",
      label: "Vertriebsgebühr",
      amount: scenario.salesFeePercent,
      allocation: "percent_of_goods",
      phase: "vertrieb",
    },
  ];
}

function sellPriceFor(scenario: Scenario, dealer: Dealer | undefined): number {
  if (scenario.sellPrice > 0) return scenario.sellPrice;
  if (dealer) return dealer.defaultSellPrice;
  return 0;
}

export default function ComparePage() {
  const { ready, data } = useStore();
  const { t, locale, pricingUnitLabel } = useI18n();
  const [scenarios, setScenarios] = useState<Scenario[]>([
    emptyScenario(),
    emptyScenario(),
  ]);
  const [sensitivityQty, setSensitivityQty] = useState<number | "">("");
  const [initialized, setInitialized] = useState(false);

  /** Prefill: gleiches Katalogprodukt in mehreren Szenarien */
  useEffect(() => {
    if (!ready || initialized || data.catalogProducts.length === 0) return;

    const first = data.catalogProducts[0];
    setScenarios((prev) =>
      prev.map((s, i) => ({
        ...s,
        productId:
          data.catalogProducts[Math.min(i, data.catalogProducts.length - 1)]
            ?.id ?? first.id,
      })),
    );
    setInitialized(true);
  }, [ready, initialized, data.catalogProducts]);

  const columns = useMemo(() => {
    return scenarios.map((scenario, index) => {
      const product = data.catalogProducts.find(
        (p) => p.id === scenario.productId,
      );
      const supplierIds = product
        ? [
            ...new Set(
              data.components
                .filter((c) => c.productId === product.id && c.supplierId)
                .map((c) => c.supplierId),
            ),
          ]
        : [];
      const supplier = data.suppliers.find((s) => s.id === supplierIds[0]);
      const dealer = data.dealers.find((d) => d.id === scenario.dealerId);
      const qty =
        sensitivityQty === "" ? scenario.quantity : Number(sensitivityQty);
      const unitPrice = product
        ? catalogProductUnitPurchaseCost(product.id, data.components)
        : 0;
      const sellPrice = sellPriceFor(scenario, dealer);
      const econ = calculateUnitEconomics({
        quantity: qty,
        unitPurchasePrice: unitPrice,
        procurementItems: procurementItems({ ...scenario, quantity: qty }),
        sellPrice,
        salesItems: salesItemsFor(scenario, dealer),
      });
      return {
        scenario,
        index,
        product,
        supplier,
        dealer,
        unitPrice,
        sellPrice,
        qty,
        econ,
      };
    });
  }, [scenarios, data, sensitivityQty]);

  function update(index: number, patch: Partial<Scenario>) {
    setScenarios((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  function applyDealer(index: number, dealerId: string) {
    const dealer = data.dealers.find((d) => d.id === dealerId);
    update(index, {
      dealerId,
      // Händler-Default übernehmen; manuell überschreibbar
      sellPrice: dealer?.defaultSellPrice ?? 0,
      salesFeePercent: 0,
    });
  }

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  const bestMargin = Math.max(
    ...columns.map((c) => c.econ.contributionPerUnit),
    Number.NEGATIVE_INFINITY,
  );
  const showTable =
    columns.length >= 2 && columns.every((c) => Boolean(c.product));

  const metricRows: {
    key: string;
    label: string;
    highlight?: boolean;
    get: (c: (typeof columns)[0]) => string;
  }[] = [
    {
      key: "purchase",
      label: t("compare.metric.purchase"),
      get: (c) => formatEuro(c.unitPrice, locale),
    },
    {
      key: "landed",
      label: t("compare.metric.landed"),
      get: (c) => formatEuro(c.econ.landedCostPerUnit, locale),
    },
    {
      key: "sell",
      label: t("compare.metric.sell"),
      get: (c) => formatEuro(c.sellPrice, locale),
    },
    {
      key: "salesCosts",
      label: t("compare.metric.salesCosts"),
      get: (c) => formatEuro(c.econ.salesCostsPerUnit, locale),
    },
    {
      key: "marginEuro",
      label: t("compare.metric.marginEuro"),
      highlight: true,
      get: (c) => formatEuro(c.econ.contributionPerUnit, locale),
    },
    {
      key: "marginPct",
      label: t("compare.metric.marginPct"),
      highlight: true,
      get: (c) => formatPercent(c.econ.contributionPercent, locale),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("compare.title")}
        description={t("compare.description")}
        action={
          <div className="flex gap-2">
            {scenarios.length < 3 ? (
              <Button
                variant="ghost"
                onClick={() =>
                  setScenarios((prev) => [...prev, emptyScenario()])
                }
              >
                {t("compare.addScenario")}
              </Button>
            ) : null}
            {scenarios.length > 2 ? (
              <Button
                variant="ghost"
                onClick={() => setScenarios((prev) => prev.slice(0, -1))}
              >
                {t("compare.removeScenario")}
              </Button>
            ) : null}
          </div>
        }
      />

      <Card className="mb-6">
        <Field
          label={t("compare.sensitivity")}
          hint={t("compare.sensitivityHint")}
        >
          <TextInput
            type="number"
            min="1"
            placeholder={t("compare.sensitivityPlaceholder")}
            value={sensitivityQty}
            onChange={(e) =>
              setSensitivityQty(
                e.target.value === "" ? "" : Number(e.target.value) || 0,
              )
            }
            className="max-w-xs"
          />
        </Field>
      </Card>

      <div className="overflow-x-auto">
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${columns.length}, minmax(260px, 1fr))`,
          }}
        >
          {columns.map(
            ({
              scenario,
              index,
              product,
              supplier,
              dealer,
              unitPrice,
              qty,
              econ,
            }) => (
              <Card key={index}>
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                  {t("compare.scenario", { n: index + 1 })}
                </p>

                <div className="space-y-3">
                  <Field label={t("compare.product")}>
                    <Select
                      value={scenario.productId}
                      onChange={(e) =>
                        update(index, { productId: e.target.value })
                      }
                    >
                      <option value="">{t("compare.selectProduct")}</option>
                      {[...data.catalogProducts]
                        .filter((p) => p.status === "active")
                        .sort((a, b) =>
                          a.name.localeCompare(b.name, locale),
                        )
                        .map((p) => {
                          const comps = data.components.filter(
                            (c) => c.productId === p.id && c.supplierId,
                          );
                          const supplierNames = [
                            ...new Set(
                              comps.map(
                                (c) =>
                                  data.suppliers.find((s) => s.id === c.supplierId)
                                    ?.name ?? "?",
                              ),
                            ),
                          ].join(", ");
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name}
                              {supplierNames ? ` — ${supplierNames}` : ""}
                            </option>
                          );
                        })}
                    </Select>
                  </Field>

                  <Field
                    label={
                      product
                        ? t("unit.qtyLabel", {
                            unit: pricingUnitLabel(product.pricingUnit),
                          })
                        : t("compare.quantity")
                    }
                  >
                    <TextInput
                      type="number"
                      min="1"
                      value={scenario.quantity || ""}
                      onChange={(e) =>
                        update(index, {
                          quantity: Number(e.target.value) || 0,
                        })
                      }
                      disabled={sensitivityQty !== ""}
                    />
                  </Field>

                  <Field label={t("compare.freight")}>
                    <TextInput
                      type="number"
                      min="0"
                      value={scenario.freight || ""}
                      onChange={(e) =>
                        update(index, {
                          freight: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </Field>

                  <Field label={t("compare.duty")}>
                    <TextInput
                      type="number"
                      step="0.1"
                      min="0"
                      value={scenario.dutyPercent || ""}
                      onChange={(e) =>
                        update(index, {
                          dutyPercent: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </Field>

                  <Field label={t("compare.other")}>
                    <TextInput
                      type="number"
                      min="0"
                      value={scenario.otherLump || ""}
                      onChange={(e) =>
                        update(index, {
                          otherLump: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </Field>

                  <Field
                    label={t("compare.dealer")}
                    hint={t("compare.dealerHint")}
                  >
                    <Select
                      value={scenario.dealerId}
                      onChange={(e) => applyDealer(index, e.target.value)}
                    >
                      <option value="">{t("compare.noDealer")}</option>
                      {[...data.dealers]
                        .filter((d) => d.status === "active")
                        .sort((a, b) =>
                          a.name.localeCompare(b.name, locale),
                        )
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                            {d.defaultSellPrice > 0
                              ? ` · ${formatEuro(d.defaultSellPrice, locale)}`
                              : ""}
                          </option>
                        ))}
                    </Select>
                  </Field>

                  <Field
                    label={t("compare.sellPrice", {
                      unit: product
                        ? pricingUnitLabel(product.pricingUnit)
                        : pricingUnitLabel("pcs"),
                    })}
                  >
                    <TextInput
                      type="number"
                      step="0.01"
                      min="0"
                      value={scenario.sellPrice || ""}
                      onChange={(e) =>
                        update(index, {
                          sellPrice: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </Field>

                  {!dealer ? (
                    <Field label={t("compare.salesFee")}>
                      <TextInput
                        type="number"
                        step="0.1"
                        min="0"
                        value={scenario.salesFeePercent || ""}
                        onChange={(e) =>
                          update(index, {
                            salesFeePercent: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </Field>
                  ) : (
                    <p className="text-[12px] text-muted">
                      {t("compare.salesFromDealer", {
                        count: dealer.salesCostItems.length,
                      })}
                    </p>
                  )}
                </div>

                <div className="mt-5 border-t border-line pt-4 text-[13px]">
                  <p className="text-[12px] text-muted">
                    {supplier?.name ?? t("common.emDash")} ·{" "}
                    {t("compare.qty", {
                      count: formatNumber(qty, locale),
                      unit: product
                        ? pricingUnitLabel(product.pricingUnit)
                        : pricingUnitLabel("pcs"),
                    })}
                    {product
                      ? ` · ${t("compare.ekShort")} ${formatEuro(unitPrice, locale)}`
                      : ""}
                  </p>
                  <dl className="mt-3 space-y-2">
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">{t("compare.metric.landed")}</dt>
                      <dd className="font-medium tabular-nums">
                        {formatEuro(econ.landedCostPerUnit, locale)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">
                        {t("compare.metric.marginEuro")}
                      </dt>
                      <dd
                        className={`font-medium tabular-nums ${
                          econ.contributionPerUnit >= 0
                            ? "text-accent"
                            : "text-danger"
                        }`}
                      >
                        {formatEuro(econ.contributionPerUnit, locale)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-muted">
                        {t("compare.metric.marginPct")}
                      </dt>
                      <dd className="tabular-nums">
                        {formatPercent(econ.contributionPercent, locale)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </Card>
            ),
          )}
        </div>
      </div>

      {showTable ? (
        <Card className="mt-6 overflow-x-auto">
          <h2 className="mb-3 text-[14px] font-medium text-foreground">
            {t("compare.tableTitle")}
          </h2>
          <table className="w-full min-w-[480px] text-left text-[13px]">
            <thead className="border-b border-line text-[11px] uppercase tracking-[0.04em] text-muted-soft">
              <tr>
                <th className="py-2 pr-4 font-medium">
                  {t("compare.metricCol")}
                </th>
                {columns.map((c) => (
                  <th
                    key={c.index}
                    className="py-2 pr-4 text-right font-medium"
                  >
                    {t("compare.scenario", { n: c.index + 1 })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricRows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-line/60 last:border-0"
                >
                  <td className="py-2.5 pr-4 text-muted">{row.label}</td>
                  {columns.map((c) => {
                    const isBest =
                      row.highlight &&
                      Number.isFinite(bestMargin) &&
                      c.econ.contributionPerUnit === bestMargin;
                    return (
                      <td
                        key={c.index}
                        className={`py-2.5 pr-4 text-right tabular-nums ${
                          isBest ? "font-medium text-accent" : ""
                        }`}
                      >
                        {row.get(c)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </div>
  );
}
