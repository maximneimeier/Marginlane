"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/context/StoreContext";
import type { Batch } from "@/lib/types";
import { PROCUREMENT_PHASES } from "@/lib/types";
import { calculateUnitEconomics, effectiveUnitPrice } from "@/lib/calc";
import { formatEuro, formatPercent } from "@/lib/format";
import { salesFromDealer } from "@/lib/storage";
import { CostItemEditor } from "@/components/CostItemEditor";
import { SalesCostsReadonly } from "@/components/SalesCostsReadonly";
import { WaterfallChart } from "@/components/WaterfallChart";
import {
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  TextInput,
} from "@/components/ui";

export default function ChargeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { ready, data, upsertBatch, deleteBatch } = useStore();
  const stored = data.batches.find((b) => b.id === id);
  const [draft, setDraft] = useState<Batch | null>(null);
  const [editing, setEditing] = useState(false);

  const batch = editing && draft ? draft : stored;

  if (!ready) return <p className="text-sm text-muted">Laden…</p>;
  if (!stored || !batch) {
    return (
      <main>
        <p className="text-sm text-muted">Charge nicht gefunden.</p>
        <Link href="/chargen" className="mt-3 inline-block text-sm text-accent">
          Zurück
        </Link>
      </main>
    );
  }

  const product = data.products.find((p) => p.id === batch.productId);
  const supplier = data.suppliers.find((s) => s.id === batch.supplierId);
  const econ = calculateUnitEconomics({
    quantity: batch.quantity,
    unitPurchasePrice: batch.unitPurchasePrice,
    procurementItems: batch.costItems,
    sellPrice: batch.sales.sellPrice,
    salesItems: batch.sales.costItems,
  });

  function startEdit() {
    setDraft(structuredClone(stored!));
    setEditing(true);
  }

  function save() {
    if (!draft) return;
    upsertBatch(draft);
    setEditing(false);
    setDraft(null);
  }

  return (
    <main>
      <PageHeader
        title={batch.label}
        description={`${product?.name ?? "Produkt"} · ${supplier?.name ?? "Lieferant"} · ${batch.quantity.toLocaleString("de-DE")} Stk.`}
        action={
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button onClick={save}>Speichern</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setDraft(null);
                  }}
                >
                  Abbrechen
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={startEdit}>
                  Bearbeiten
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm("Charge löschen?")) {
                      deleteBatch(batch.id);
                      router.push("/chargen");
                    }
                  }}
                >
                  Löschen
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">Einkauf</p>
          <p className="mt-1 text-xl tabular-nums">
            {formatEuro(econ.purchasePerUnit)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">
            Landed Cost
          </p>
          <p className="mt-1 text-xl tabular-nums font-medium text-accent">
            {formatEuro(econ.landedCostPerUnit)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">VK</p>
          <p className="mt-1 text-xl tabular-nums">
            {formatEuro(econ.sellPrice)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-muted">
            Deckungsbeitrag
          </p>
          <p
            className={`mt-1 text-xl tabular-nums ${
              econ.contributionPerUnit >= 0 ? "text-accent" : "text-red-700"
            }`}
          >
            {formatEuro(econ.contributionPerUnit)}
          </p>
          <p className="text-xs text-muted">
            {formatPercent(econ.contributionPercent)}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          {editing && draft ? (
            <>
              <Card>
                <h2 className="mb-4 font-medium">Basisdaten</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Bezeichnung">
                    <TextInput
                      value={draft.label}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev ? { ...prev, label: e.target.value } : prev,
                        )
                      }
                    />
                  </Field>
                  <Field
                    label="Menge"
                    hint={
                      product?.moq
                        ? `MOQ: ${product.moq.toLocaleString("de-DE")} Stk.`
                        : undefined
                    }
                  >
                    <TextInput
                      type="number"
                      min="1"
                      value={draft.quantity || ""}
                      onChange={(e) => {
                        const quantity = Number(e.target.value) || 0;
                        setDraft((prev) => {
                          if (!prev) return prev;
                          const prod = data.products.find(
                            (p) => p.id === prev.productId,
                          );
                          const unitPurchasePrice = prod
                            ? effectiveUnitPrice(
                                prod.unitPrice,
                                quantity,
                                prod.discountTiers,
                              )
                            : prev.unitPurchasePrice;
                          return {
                            ...prev,
                            quantity,
                            unitPurchasePrice,
                            sales: { ...prev.sales, quantity },
                          };
                        });
                      }}
                    />
                  </Field>
                  <Field
                    label="EK / Stück"
                    hint="Aus Produktpreis und Rabattstaffel zur Menge."
                  >
                    <div className="flex h-[34px] items-center rounded-[8px] border border-line bg-surface-faint px-3 text-[13px] tabular-nums text-foreground">
                      {formatEuro(draft.unitPurchasePrice)}
                    </div>
                  </Field>
                  <Field
                    label="Zahlungskonditionen"
                    hint="Vom Lieferanten — hier nicht änderbar."
                  >
                    <div className="flex h-[34px] items-center rounded-[8px] border border-line bg-surface-faint px-3 text-[13px] text-foreground">
                      {draft.paymentTerms || "—"}
                    </div>
                  </Field>
                </div>
              </Card>
              <Card>
                <CostItemEditor
                  title="Beschaffungskosten"
                  items={draft.costItems}
                  onChange={(costItems) => setDraft({ ...draft, costItems })}
                  allowedPhases={PROCUREMENT_PHASES}
                />
              </Card>
              <Card>
                <h2 className="mb-4 font-medium">Verkauf</h2>
                <div className="mb-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Händler">
                    <Select
                      value={draft.sales.dealerId || ""}
                      onChange={(e) => {
                        const id = e.target.value;
                        setDraft((prev) => {
                          if (!prev) return prev;
                          if (!id) {
                            return {
                              ...prev,
                              sales: {
                                ...prev.sales,
                                dealerId: "",
                                channel: "",
                                sellPrice: 0,
                                costItems: [],
                              },
                            };
                          }
                          const next = data.dealers.find((d) => d.id === id);
                          if (!next) return prev;
                          return {
                            ...prev,
                            sales: {
                              ...prev.sales,
                              quantity: prev.quantity,
                              ...salesFromDealer(next),
                            },
                          };
                        });
                      }}
                    >
                      <option value="">Händler wählen…</option>
                      {data.dealers.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                          {d.defaultSellPrice > 0
                            ? ` · VK ${formatEuro(d.defaultSellPrice)}`
                            : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field
                    label="Verkaufspreis / Stück"
                    hint="Kommt vom Händler — dort ändern."
                  >
                    <div className="flex h-[34px] items-center rounded-[8px] border border-line bg-surface-faint px-3 text-[13px] tabular-nums text-foreground">
                      {draft.sales.sellPrice > 0
                        ? formatEuro(draft.sales.sellPrice)
                        : "—"}
                    </div>
                  </Field>
                </div>
                <SalesCostsReadonly
                  items={draft.sales.costItems}
                  emptyHint="Händler wählen, um Vertriebskosten zu sehen."
                />
              </Card>
            </>
          ) : (
            <>
              <Card>
                <h2 className="mb-3 font-medium">Beschaffung</h2>
                <p className="mb-3 text-sm text-muted">
                  {batch.paymentTerms || "Keine Zahlungskonditionen"}
                </p>
                {econ.procurementBreakdown.length === 0 ? (
                  <p className="text-sm text-muted">Keine Kostenposten.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {econ.procurementBreakdown.map((row) => (
                      <li
                        key={row.item.id}
                        className="flex justify-between gap-3 border-b border-line/60 py-2 last:border-0"
                      >
                        <span>
                          {row.item.label}
                          <span className="ml-2 text-xs text-muted">
                            {row.item.allocation === "lump_sum"
                              ? "pauschal"
                              : row.item.allocation === "per_unit"
                                ? "pro Stück"
                                : "% Warenwert"}
                          </span>
                        </span>
                        <span className="tabular-nums">
                          {formatEuro(row.perUnit)}
                          <span className="ml-2 text-xs text-muted">
                            ({formatEuro(row.total)} gesamt)
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card>
                <h2 className="mb-3 font-medium">
                  Verkauf —{" "}
                  {data.dealers.find((d) => d.id === batch.sales.dealerId)
                    ?.name ||
                    batch.sales.channel ||
                    "ohne Händler"}
                </h2>
                {econ.salesBreakdown.length === 0 ? (
                  <p className="text-sm text-muted">Keine Vertriebskosten.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {econ.salesBreakdown.map((row) => (
                      <li
                        key={row.item.id}
                        className="flex justify-between gap-3 border-b border-line/60 py-2 last:border-0"
                      >
                        <span>{row.item.label}</span>
                        <span className="tabular-nums">
                          {formatEuro(row.perUnit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>

        <aside>
          <Card>
            <h2 className="mb-1 font-medium">Unit Economics</h2>
            <p className="mb-5 text-xs text-muted">
              Wasserfall: Einkauf → Beschaffung → Landed Cost → Vertrieb → Marge
            </p>
            <WaterfallChart steps={econ.waterfall} />
          </Card>
        </aside>
      </div>
    </main>
  );
}
