"use client";

import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import { calculateUnitEconomics } from "@/lib/calc";
import { formatEuro, formatPercent } from "@/lib/format";
import { Button, Card, PageHeader } from "@/components/ui";

export default function HomePage() {
  const { ready, data, resetDemo } = useStore();

  if (!ready) {
    return <p className="text-[13px] text-muted">Laden…</p>;
  }

  const rows = data.batches.map((batch) => {
    const product = data.products.find((p) => p.id === batch.productId);
    const supplier = data.suppliers.find((s) => s.id === batch.supplierId);
    const econ = calculateUnitEconomics({
      quantity: batch.quantity,
      unitPurchasePrice: batch.unitPurchasePrice,
      procurementItems: batch.costItems,
      sellPrice: batch.sales.sellPrice,
      salesItems: batch.sales.costItems,
    });
    return { batch, product, supplier, econ };
  });

  return (
    <div>
      <PageHeader
        title="Übersicht"
        description="Unit Economics über alle Chargen — Landed Cost und Nettomarge auf einen Blick."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={resetDemo}>
              Demo zurücksetzen
            </Button>
            <Link href="/chargen?new=1">
              <Button>Neue Charge</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          ["Lieferanten", data.suppliers.length],
          ["Produkte", data.products.length],
          ["Chargen", data.batches.length],
        ].map(([label, value]) => (
          <Card key={label as string} className="!p-4">
            <p className="text-[12px] font-medium text-muted">{label}</p>
            <p className="mt-1 text-[28px] font-semibold tracking-[-0.03em] tabular-nums">
              {value}
            </p>
          </Card>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">
            Noch keine Chargen. Lege einen Lieferanten an und erfasse die erste
            Bestellung.
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/lieferanten">
              <Button variant="secondary">Zu Lieferanten</Button>
            </Link>
            <Button onClick={resetDemo}>Demo laden</Button>
          </div>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                <th className="px-4 py-2.5 font-medium">Charge</th>
                <th className="px-4 py-2.5 font-medium">Produkt</th>
                <th className="px-4 py-2.5 font-medium">Lieferant</th>
                <th className="px-4 py-2.5 font-medium text-right">Landed Cost</th>
                <th className="px-4 py-2.5 font-medium text-right">VK</th>
                <th className="px-4 py-2.5 font-medium text-right">Marge</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ batch, product, supplier, econ }) => (
                <tr
                  key={batch.id}
                  className="border-b border-line last:border-0 hover:bg-surface-faint"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/chargen/${batch.id}`}
                      className="font-medium text-foreground hover:text-accent"
                    >
                      {batch.label}
                    </Link>
                    <p className="text-[12px] text-muted-soft">
                      {batch.quantity.toLocaleString("de-DE")} Stk.
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted">{product?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {supplier?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatEuro(econ.landedCostPerUnit)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatEuro(econ.sellPrice)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`tabular-nums font-medium ${
                        econ.contributionPerUnit >= 0
                          ? "text-success"
                          : "text-danger"
                      }`}
                    >
                      {formatEuro(econ.contributionPerUnit)}
                    </span>
                    <span className="ml-1.5 text-[12px] text-muted-soft">
                      {formatPercent(econ.contributionPercent)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
