"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { calculateResolvedEconomics } from "@/lib/resolve";
import { formatEuro, formatNumber, formatPercent } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { BatchFormModal } from "@/components/BatchFormModal";
import { Button, Card, PageHeader } from "@/components/ui";

function ChargenPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, data, upsertBatch, deleteBatch } = useStore();
  const { t, locale, pricingUnitLabel } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [initialProductId, setInitialProductId] = useState("");

  useEffect(() => {
    if (!ready) return;
    const wantsNew = searchParams.get("new") === "1";
    const product = searchParams.get("product") ?? "";
    if (!wantsNew && !product) return;
    setInitialProductId(product);
    setModalOpen(true);
    router.replace("/batches", { scroll: false });
  }, [ready, searchParams, router]);

  if (!ready) return <p className="text-sm text-muted">{t("common.loading")}</p>;

  return (
    <div>
      <BatchFormModal
        open={modalOpen}
        data={data}
        initialProductId={initialProductId}
        onClose={() => {
          setModalOpen(false);
          setInitialProductId("");
        }}
        onSave={(batch) => {
          upsertBatch(batch);
          router.push(`/batches/${batch.id}`);
        }}
      />

      <PageHeader
        title={t("batches.title")}
        description={t("batches.description")}
        action={
          <Button
            onClick={() => {
              setInitialProductId("");
              setModalOpen(true);
            }}
          >
            {t("batches.add")}
          </Button>
        }
      />

      {data.batches.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">{t("batches.empty")}</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_0.9fr_auto] gap-3 border-b border-line bg-surface-faint px-4 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
            <span>{t("batches.col.batch")}</span>
            <span>{t("batches.col.product")}</span>
            <span>{t("batches.col.supplier")}</span>
            <span className="text-right">{t("batches.col.landed")}</span>
            <span className="text-right">{t("batches.col.margin")}</span>
            <span />
          </div>
          <ul>
            {data.batches.map((batch) => {
              const product = data.products.find((p) => p.id === batch.productId);
              const supplier = data.suppliers.find(
                (s) => s.id === batch.supplierId,
              );
              const econ = calculateResolvedEconomics(data, batch);

              return (
                <li
                  key={batch.id}
                  className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_0.9fr_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-faint"
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
                  <span className="truncate text-[13px] text-muted">
                    {product?.name ?? t("common.emDash")}
                  </span>
                  <span className="truncate text-[13px] text-muted">
                    {supplier?.name ?? t("common.emDash")}
                  </span>
                  <span className="text-right text-[13px] tabular-nums">
                    {formatEuro(econ.landedCostPerUnit, locale)}
                  </span>
                  <span className="text-right text-[13px]">
                    <span
                      className={`font-medium tabular-nums ${
                        econ.contributionPerUnit >= 0
                          ? "text-success"
                          : "text-danger"
                      }`}
                    >
                      {formatEuro(econ.contributionPerUnit, locale)}
                    </span>
                    <span className="ml-1 text-[12px] text-muted-soft">
                      {formatPercent(econ.contributionPercent, locale)}
                    </span>
                  </span>
                  <Button
                    variant="danger"
                    className="justify-self-end"
                    onClick={() => {
                      if (confirm(t("batches.deleteConfirm"))) deleteBatch(batch.id);
                    }}
                  >
                    ×
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function ChargenPageFallback() {
  const { t } = useI18n();
  return <p className="text-sm text-muted">{t("common.loading")}</p>;
}

export default function ChargenPage() {
  return (
    <Suspense fallback={<ChargenPageFallback />}>
      <ChargenPageInner />
    </Suspense>
  );
}
