"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import { calculateResolvedEconomics } from "@/lib/resolve";
import { formatMoney, formatPercent } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { Button, Card, Field, PageHeader, Select } from "@/components/ui";

export default function ComparePageClient() {
  const { ready, data } = useStore();
  const { t, locale } = useI18n();
  const [productId, setProductId] = useState(
    data.catalogProducts[0]?.id ?? "",
  );
  const [selected, setSelected] = useState<string[]>([]);

  const productBatches = useMemo(
    () =>
      data.batches.filter((b) =>
        productId ? b.productId === productId : true,
      ),
    [data.batches, productId],
  );

  const rows = useMemo(() => {
    return selected
      .map((id) => data.batches.find((b) => b.id === id))
      .filter(Boolean)
      .map((batch) => {
        const econ = calculateResolvedEconomics(data, batch!);
        return { batch: batch!, econ };
      });
  }, [selected, data]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 4
          ? prev
          : [...prev, id],
    );
  }

  if (!ready) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }

  return (
    <main>
      <PageHeader
        title={t("compare.title")}
        description={t("compare.description")}
      />

      <Card className="mb-6 space-y-4">
        <Field label={t("compare.product")}>
          <Select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setSelected([]);
            }}
          >
            <option value="">{t("compare.allProducts")}</option>
            {data.catalogProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-medium text-foreground">
            {t("compare.pickBatches")}
          </p>
          <div className="flex flex-wrap gap-2">
            {productBatches.length === 0 ? (
              <p className="text-[13px] text-muted">{t("compare.empty")}</p>
            ) : (
              productBatches.map((b) => {
                const on = selected.includes(b.id);
                return (
                  <Button
                    key={b.id}
                    type="button"
                    variant={on ? "primary" : "ghost"}
                    onClick={() => toggle(b.id)}
                  >
                    {b.label}
                  </Button>
                );
              })
            )}
          </div>
        </div>
      </Card>

      {rows.length >= 2 ? (
        <div className="overflow-x-auto rounded-[12px] border border-line">
          <table className="min-w-full text-left text-[13px]">
            <thead className="bg-surface-faint text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">{t("compare.metric")}</th>
                {rows.map(({ batch }) => (
                  <th key={batch.id} className="px-3 py-2 font-medium">
                    <Link
                      href={`/batches/${batch.id}`}
                      className="text-accent hover:underline"
                    >
                      {batch.label}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  [
                    t("compare.supplier"),
                    ...rows.map(
                      (r) =>
                        r.econ.supplier?.name ??
                        r.batch.supplierId ??
                        "—",
                    ),
                  ],
                  [
                    t("compare.incoterm"),
                    ...rows.map((r) => r.econ.commercial.incoterm || "—"),
                  ],
                  [
                    t("compare.currency"),
                    ...rows.map((r) => r.econ.commercial.currency),
                  ],
                  [
                    t("batchDetail.purchase"),
                    ...rows.map((r) =>
                      formatMoney(
                        r.econ.purchasePerUnit,
                        r.econ.baseCurrency,
                        locale,
                      ),
                    ),
                  ],
                  [
                    t("batchDetail.landedCost"),
                    ...rows.map((r) =>
                      formatMoney(
                        r.econ.landedCostPerUnit,
                        r.econ.baseCurrency,
                        locale,
                      ),
                    ),
                  ],
                  [
                    t("batchDetail.sellPriceShort"),
                    ...rows.map((r) =>
                      formatMoney(
                        r.econ.sellPrice,
                        r.econ.baseCurrency,
                        locale,
                      ),
                    ),
                  ],
                  [
                    t("batchDetail.contribution"),
                    ...rows.map((r) =>
                      formatMoney(
                        r.econ.contributionPerUnit,
                        r.econ.baseCurrency,
                        locale,
                      ),
                    ),
                  ],
                  [
                    t("compare.margin"),
                    ...rows.map((r) =>
                      formatPercent(r.econ.contributionPercent),
                    ),
                  ],
                ] as [string, ...string[]][]
              ).map(([label, ...cells]) => (
                <tr key={label} className="border-t border-line">
                  <td className="px-3 py-2 text-muted">{label}</td>
                  {cells.map((cell, i) => (
                    <td key={i} className="px-3 py-2 tabular-nums">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[13px] text-muted">{t("compare.needTwo")}</p>
      )}
    </main>
  );
}
