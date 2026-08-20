"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import type { Batch } from "@/lib/types";
import { applyQuickSale, markBatchSold } from "@/lib/batchPipeline";
import { calculateResolvedEconomics } from "@/lib/resolve";
import { saleFromDealer } from "@/lib/storage";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { Button, Card, Field, Select, TextInput } from "@/components/ui";

type Props = {
  batch: Batch;
  highlight?: boolean;
};

export function BatchQuickSellCard({ batch, highlight }: Props) {
  const { data, upsertBatch } = useStore();
  const { t, locale, pricingUnitLabel } = useI18n();
  const econ = calculateResolvedEconomics(data, batch);
  const remaining = econ.remainingQuantity;
  const product = data.catalogProducts.find((p) => p.id === batch.productId);
  const unit = pricingUnitLabel(product?.pricingUnit ?? "pcs");
  const activeDealers = useMemo(
    () => data.dealers.filter((d) => d.status === "active"),
    [data.dealers],
  );

  const [dealerId, setDealerId] = useState(
    () => batch.sales.find((s) => s.dealerId)?.dealerId || "",
  );
  const [quantity, setQuantity] = useState(remaining > 0 ? remaining : 0);
  const [price, setPrice] = useState<number | "">(() => {
    const sale = batch.sales.find((s) => s.salePricePerUnit != null);
    if (sale?.salePricePerUnit != null) return sale.salePricePerUnit;
    const dealer = data.dealers.find((d) => d.id === dealerId);
    return dealer?.defaultSellPrice || "";
  });

  if (remaining <= 0) {
    return (
      <Card className={highlight ? "ring-1 ring-accent/30" : undefined}>
        <h2 className="text-[14px] font-semibold">{t("batchSell.titleSold")}</h2>
        <p className="mt-1 text-[13px] text-muted">{t("batchSell.fullySold")}</p>
        {batch.soldDate ? (
          <p className="mt-2 text-[12px] text-muted-soft">
            {t("batchDetail.soldDate")}: {batch.soldDate.slice(0, 10)}
          </p>
        ) : null}
      </Card>
    );
  }

  function onDealerChange(id: string) {
    setDealerId(id);
    const dealer = data.dealers.find((d) => d.id === id);
    if (dealer && price === "") {
      setPrice(dealer.defaultSellPrice || "");
    }
  }

  function saveSale() {
    const qty = Number(quantity);
    if (!(qty > 0) || qty > remaining) return;
    const dealer = data.dealers.find((d) => d.id === dealerId);
    const linked = dealer ? saleFromDealer(dealer, qty) : null;
    upsertBatch(
      applyQuickSale(batch, {
        dealerId: dealerId || null,
        quantity: qty,
        salePricePerUnit:
          price === ""
            ? linked?.salePricePerUnit ?? null
            : Number(price),
        channel: linked?.channel || "",
      }),
    );
  }

  function sellRest() {
    upsertBatch(markBatchSold(batch, remaining, undefined, dealerId || null));
  }

  return (
    <Card className={highlight ? "ring-1 ring-accent/30" : undefined}>
      <h2 className="text-[14px] font-semibold">{t("batchSell.title")}</h2>
      <p className="mt-1 text-[13px] text-muted">
        {t("batchSell.hint", {
          remaining: formatNumber(remaining, locale),
          unit,
        })}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label={t("batchModal.dealer")}>
          <Select
            value={dealerId}
            onChange={(e) => onDealerChange(e.target.value)}
          >
            <option value="">{t("batchModal.noDealer")}</option>
            {activeDealers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("batchSell.quantity", { unit })}>
          <TextInput
            type="number"
            min={1}
            max={remaining}
            value={quantity || ""}
            onChange={(e) => setQuantity(Number(e.target.value) || 0)}
          />
        </Field>
        <Field label={t("batchModal.sellPrice", { unit })}>
          <TextInput
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) =>
              setPrice(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </Field>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={saveSale} disabled={!(quantity > 0 && quantity <= remaining)}>
          {t("batchSell.save")}
        </Button>
        <Button variant="ghost" onClick={sellRest}>
          {t("batchSell.markSold")}
        </Button>
      </div>
    </Card>
  );
}
