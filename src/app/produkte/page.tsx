"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import type { Product } from "@/lib/types";
import { formatEuro, formatPercent } from "@/lib/format";
import { buildProductMetrics, formatDateDe } from "@/lib/supplierRows";
import { CountryFlag } from "@/components/CountryFlag";
import {
  ProductFormModal,
  emptyProduct,
} from "@/components/ProductFormModal";
import {
  Button,
  Card,
  ConfirmDialog,
  PageHeader,
  Select,
  TextInput,
} from "@/components/ui";

export default function ProduktePage() {
  const { ready, data, upsertProduct, deleteProduct } = useStore();
  const [query, setQuery] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [draft, setDraft] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.products
      .filter((p) => {
        if (filterSupplier && p.supplierId !== filterSupplier) return false;
        if (!q) return true;
        const supplier = data.suppliers.find((s) => s.id === p.supplierId);
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (supplier?.name.toLowerCase().includes(q) ?? false)
        );
      })
      .map((product) => {
        const supplier = data.suppliers.find((s) => s.id === product.supplierId);
        const metrics = buildProductMetrics(product.id, data.batches);
        return { product, supplier, metrics };
      })
      .sort((a, b) => a.product.name.localeCompare(b.product.name, "de"));
  }, [data, query, filterSupplier]);

  if (!ready) return <p className="text-[13px] text-muted">Laden…</p>;

  const isEdit = Boolean(draft && data.products.some((p) => p.id === draft.id));

  return (
    <div>
      <PageHeader
        title="Produkte"
        description="Alle Artikel über Lieferanten hinweg — Preise, MOQ und Unit Economics."
        action={
          <Button
            onClick={() => {
              const first = data.suppliers[0];
              if (!first) return;
              setDraft(emptyProduct(first.id));
            }}
            disabled={data.suppliers.length === 0}
          >
            + Produkt
          </Button>
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Produkt löschen?"
        description={
          deleteTarget
            ? `„${deleteTarget.name}“ und zugehörige Chargen werden gelöscht.`
            : ""
        }
        confirmLabel="Endgültig löschen"
        onConfirm={() => {
          if (deleteTarget) deleteProduct(deleteTarget.id);
        }}
      />

      <ProductFormModal
        open={Boolean(draft)}
        initial={draft}
        suppliers={data.suppliers}
        isEdit={isEdit}
        onClose={() => setDraft(null)}
        onSave={(product) => {
          upsertProduct(product);
        }}
      />

      {data.suppliers.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">
            Lege zuerst einen Lieferanten an, bevor du Produkte erfassen kannst.
          </p>
          <Link href="/lieferanten" className="mt-3 inline-block">
            <Button variant="secondary">Zu Lieferanten</Button>
          </Link>
        </Card>
      ) : (
        <>
          <div className="mb-3 flex flex-nowrap items-center gap-2 overflow-x-auto">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suche Produkt, SKU oder Lieferant…"
              className="!w-[260px] shrink-0"
            />
            <Select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="!w-[200px] shrink-0"
            >
              <option value="">Alle Lieferanten</option>
              {data.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <p className="ml-auto shrink-0 text-[12px] text-muted-soft">
              {rows.length} Produkt{rows.length === 1 ? "" : "e"}
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-muted">
              Keine Produkte gefunden.
            </div>
          ) : (
            <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                      <th className="px-4 py-2.5 font-medium">Produkt</th>
                      <th className="px-4 py-2.5 font-medium">SKU</th>
                      <th className="px-4 py-2.5 font-medium">Lieferant</th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Preis/Stk.
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">MOQ</th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Ø Landed Cost
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Chargen
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        Letzte Bestellung
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        Ø Marge
                      </th>
                      <th className="w-24 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ product, supplier, metrics }) => (
                      <tr
                        key={product.id}
                        className="group border-b border-line last:border-0 hover:bg-surface-faint"
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setDraft(product)}
                            className="text-left font-medium text-foreground hover:text-accent"
                          >
                            {product.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {product.sku || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {supplier ? (
                            <span className="inline-flex items-center gap-2 text-muted">
                              <CountryFlag code={supplier.country} />
                              {supplier.name}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatEuro(product.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {product.moq.toLocaleString("de-DE")}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {metrics.avgLandedCost != null
                            ? formatEuro(metrics.avgLandedCost)
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {metrics.batchCount}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {formatDateDe(metrics.lastOrderAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {metrics.avgMarginEuro != null ? (
                            <span
                              className={`tabular-nums ${
                                metrics.avgMarginEuro >= 0
                                  ? "text-success"
                                  : "text-danger"
                              }`}
                            >
                              {formatEuro(metrics.avgMarginEuro)}
                              <span className="ml-1 text-[12px] text-muted-soft">
                                {formatPercent(metrics.avgMarginPercent ?? 0)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-soft">—</span>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex justify-end gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                            <Link href={`/chargen?new=1&product=${product.id}`}>
                              <Button variant="ghost" className="h-7 px-2">
                                Charge
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => setDraft(product)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              className="h-7 px-2"
                              onClick={() => setDeleteTarget(product)}
                            >
                              ×
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
