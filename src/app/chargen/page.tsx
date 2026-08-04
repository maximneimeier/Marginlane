"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import { calculateUnitEconomics } from "@/lib/calc";
import { formatEuro, formatPercent } from "@/lib/format";
import { BatchFormModal } from "@/components/BatchFormModal";
import { Button, Card, PageHeader } from "@/components/ui";

function ChargenPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, data, upsertBatch, deleteBatch } = useStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [initialProductId, setInitialProductId] = useState("");

  useEffect(() => {
    if (!ready) return;
    const wantsNew = searchParams.get("new") === "1";
    const product = searchParams.get("product") ?? "";
    if (!wantsNew && !product) return;
    setInitialProductId(product);
    setModalOpen(true);
    router.replace("/chargen", { scroll: false });
  }, [ready, searchParams, router]);

  if (!ready) return <p className="text-sm text-muted">Laden…</p>;

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
          router.push(`/chargen/${batch.id}`);
        }}
      />

      <PageHeader
        title="Chargen"
        description="Konkrete Einkäufe mit Kostenposten, Landed Cost und Verkaufsseite."
        action={
          <Button
            onClick={() => {
              setInitialProductId("");
              setModalOpen(true);
            }}
          >
            Neue Charge
          </Button>
        }
      />

      {data.batches.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">Noch keine Chargen angelegt.</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_0.9fr_auto] gap-3 border-b border-line bg-surface-faint px-4 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
            <span>Charge</span>
            <span>Produkt</span>
            <span>Lieferant</span>
            <span className="text-right">Landed Cost</span>
            <span className="text-right">Marge</span>
            <span />
          </div>
          <ul>
            {data.batches.map((batch) => {
              const product = data.products.find((p) => p.id === batch.productId);
              const supplier = data.suppliers.find(
                (s) => s.id === batch.supplierId,
              );
              const econ = calculateUnitEconomics({
                quantity: batch.quantity,
                unitPurchasePrice: batch.unitPurchasePrice,
                procurementItems: batch.costItems,
                sellPrice: batch.sales.sellPrice,
                salesItems: batch.sales.costItems,
              });

              return (
                <li
                  key={batch.id}
                  className="grid grid-cols-[1.2fr_1fr_1fr_0.8fr_0.9fr_auto] items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-surface-faint"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/chargen/${batch.id}`}
                      className="font-medium text-foreground hover:text-accent"
                    >
                      {batch.label}
                    </Link>
                    <p className="text-[12px] text-muted-soft">
                      {batch.quantity.toLocaleString("de-DE")} Stk.
                    </p>
                  </div>
                  <span className="truncate text-[13px] text-muted">
                    {product?.name ?? "—"}
                  </span>
                  <span className="truncate text-[13px] text-muted">
                    {supplier?.name ?? "—"}
                  </span>
                  <span className="text-right text-[13px] tabular-nums">
                    {formatEuro(econ.landedCostPerUnit)}
                  </span>
                  <span className="text-right text-[13px]">
                    <span
                      className={`font-medium tabular-nums ${
                        econ.contributionPerUnit >= 0
                          ? "text-success"
                          : "text-danger"
                      }`}
                    >
                      {formatEuro(econ.contributionPerUnit)}
                    </span>
                    <span className="ml-1 text-[12px] text-muted-soft">
                      {formatPercent(econ.contributionPercent)}
                    </span>
                  </span>
                  <Button
                    variant="danger"
                    className="justify-self-end"
                    onClick={() => {
                      if (confirm("Charge löschen?")) deleteBatch(batch.id);
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

export default function ChargenPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Laden…</p>}>
      <ChargenPageInner />
    </Suspense>
  );
}
