"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/context/StoreContext";
import { calculateResolvedEconomics } from "@/lib/resolve";
import { getBatchContribution } from "@/lib/batchContribution";
import {
  getBatchPipelineStatus,
  isBatchRelevantForSales,
} from "@/lib/batchPipeline";
import { formatEuro, formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { Badge, Card, PageHeader } from "@/components/ui";

export default function VerkaufPageClient() {
  const { ready, data } = useStore();
  const { t, locale, pricingUnitLabel } = useI18n();

  const rows = useMemo(() => {
    return data.batches
      .filter((batch) => isBatchRelevantForSales(data, batch))
      .map((batch) => {
        const product = data.catalogProducts.find(
          (p) => p.id === batch.productId,
        );
        const econ = calculateResolvedEconomics(data, batch);
        const contrib = getBatchContribution(data, batch);
        const dealers = [
          ...new Set(
            econ.salesAggregate.rows
              .map((r) => r.dealer?.name)
              .filter((n): n is string => Boolean(n)),
          ),
        ];
        return {
          batch,
          product,
          econ,
          contrib,
          dealers,
          status: getBatchPipelineStatus(batch),
        };
      })
      .sort((a, b) => b.econ.remainingQuantity - a.econ.remainingQuantity);
  }, [data]);

  if (!ready) {
    return <p className="text-sm text-muted">{t("common.loading")}</p>;
  }

  return (
    <div>
      <PageHeader
        title={t("verkauf.page.title")}
        description={t("verkauf.page.description")}
        action={
          <Link
            href="/dealers"
            className="inline-flex h-8 items-center rounded-[8px] border border-line px-3 text-[13px] font-medium text-foreground hover:bg-surface-faint"
          >
            {t("nav.dealers")}
          </Link>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">{t("verkauf.page.empty")}</p>
          <Link
            href="/batches"
            className="mt-4 inline-flex h-8 items-center rounded-[8px] bg-foreground px-3 text-[13px] font-medium text-white hover:bg-ink-soft"
          >
            {t("verkauf.page.toBatches")}
          </Link>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
          <div className="grid grid-cols-[1.1fr_0.8fr_0.9fr_0.7fr_0.7fr_0.7fr_0.7fr_auto] gap-3 border-b border-line bg-surface-faint px-4 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
            <span>{t("batches.col.batch")}</span>
            <span>{t("batches.col.status")}</span>
            <span>{t("batches.col.product")}</span>
            <span>{t("verkauf.col.dealers")}</span>
            <span className="text-right">{t("verkauf.col.remaining")}</span>
            <span className="text-right">{t("verkauf.col.sold")}</span>
            <span className="text-right">{t("batches.col.margin")}</span>
            <span />
          </div>
          <ul>
            {rows.map(
              ({ batch, product, econ, contrib, dealers, status }) => (
                <li
                  key={batch.id}
                  className="grid grid-cols-[1.1fr_0.8fr_0.9fr_0.7fr_0.7fr_0.7fr_0.7fr_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-faint"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/batches/${batch.id}`}
                      className="font-medium text-foreground hover:text-accent"
                    >
                      {batch.label}
                    </Link>
                    <p className="text-[12px] text-muted-soft">
                      {t("batches.qty", {
                        count: formatNumber(batch.quantity, locale),
                        unit: pricingUnitLabel(product?.pricingUnit ?? "pcs"),
                      })}
                    </p>
                  </div>
                  <Badge
                    tone={status === "arrived" ? "success" : "accent"}
                  >
                    {t(`batches.pipeline.${status}`)}
                  </Badge>
                  <span className="truncate text-[13px] text-muted">
                    {product?.name ?? t("common.emDash")}
                  </span>
                  <span className="truncate text-[13px] text-muted">
                    {dealers.length > 0
                      ? dealers.join(", ")
                      : t("common.emDash")}
                  </span>
                  <span className="text-right text-[13px] tabular-nums">
                    {formatNumber(econ.remainingQuantity, locale)}
                  </span>
                  <span className="text-right text-[13px] tabular-nums">
                    {formatNumber(econ.salesAggregate.soldQuantity, locale)}
                  </span>
                  <span className="text-right text-[13px] tabular-nums">
                    {formatPercent(
                      contrib.revenue > 0
                        ? (contrib.db3 / contrib.revenue) * 100
                        : 0,
                      locale,
                    )}
                  </span>
                  <div className="flex justify-end">
                    <Link
                      href={`/batches/${batch.id}`}
                      className="inline-flex h-7 items-center rounded-[8px] px-2 text-[12px] font-medium text-accent hover:underline"
                    >
                      {t("verkauf.page.openSales")}
                    </Link>
                  </div>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
