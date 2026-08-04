"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import type { Dealer } from "@/lib/types";
import {
  DEALER_CHANNEL_LABELS,
  DEALER_STATUS_LABELS,
} from "@/lib/types";
import { calculateUnitEconomics } from "@/lib/calc";
import { formatEuro } from "@/lib/format";
import { CountryFlag } from "@/components/CountryFlag";
import {
  DealerFormModal,
  emptyDealer,
} from "@/components/DealerFormModal";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  PageHeader,
  Select,
  TextInput,
} from "@/components/ui";

function countryName(code: string) {
  const map: Record<string, string> = {
    DE: "Deutschland",
    AT: "Österreich",
    CH: "Schweiz",
    NL: "Niederlande",
    FR: "Frankreich",
  };
  return map[code] ?? code;
}

export default function HaendlerPage() {
  const { ready, data, upsertDealer, deleteDealer } = useStore();
  const [query, setQuery] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [draft, setDraft] = useState<Dealer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dealer | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...data.dealers]
      .filter((d) => {
        if (filterChannel && d.channel !== filterChannel) return false;
        if (filterStatus && d.status !== filterStatus) return false;
        if (!q) return true;
        return (
          d.name.toLowerCase().includes(q) ||
          d.contactName.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q) ||
          DEALER_CHANNEL_LABELS[d.channel].toLowerCase().includes(q)
        );
      })
      .map((dealer) => {
        const linked = data.batches.filter(
          (b) => b.sales.dealerId === dealer.id,
        );
        let marginSum = 0;
        let marginCount = 0;
        for (const batch of linked) {
          const econ = calculateUnitEconomics({
            quantity: batch.quantity,
            unitPurchasePrice: batch.unitPurchasePrice,
            procurementItems: batch.costItems,
            sellPrice: batch.sales.sellPrice,
            salesItems: batch.sales.costItems,
          });
          marginSum += econ.contributionPerUnit;
          marginCount += 1;
        }
        return {
          dealer,
          batchCount: linked.length,
          avgMargin:
            marginCount > 0 ? marginSum / marginCount : null,
        };
      })
      .sort((a, b) => a.dealer.name.localeCompare(b.dealer.name, "de"));
  }, [data.dealers, data.batches, query, filterChannel, filterStatus]);

  if (!ready) return <p className="text-[13px] text-muted">Laden…</p>;

  const isEdit = Boolean(draft && data.dealers.some((d) => d.id === draft.id));

  return (
    <div>
      <PageHeader
        title="Händler"
        description="Abnehmer, an die du verkaufst — mit Kanal, Konditionen und verknüpften Chargen."
        action={
          <Button onClick={() => setDraft(emptyDealer())}>+ Händler</Button>
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Händler löschen?"
        description={
          deleteTarget
            ? `„${deleteTarget.name}“ wird gelöscht. Verknüpfungen an Chargen werden entfernt.`
            : ""
        }
        confirmLabel="Endgültig löschen"
        onConfirm={() => {
          if (deleteTarget) deleteDealer(deleteTarget.id);
        }}
      />

      <DealerFormModal
        open={Boolean(draft)}
        initial={draft}
        isEdit={isEdit}
        onClose={() => setDraft(null)}
        onSave={(dealer) => {
          upsertDealer(dealer);
        }}
      />

      {data.dealers.length === 0 ? (
        <Card>
          <p className="text-[13px] text-muted">
            Noch keine Händler. Lege den ersten Abnehmer an — oder lade die Demo
            unter Lieferanten.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen…"
              className="max-w-[220px]"
            />
            <Select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="max-w-[180px]"
            >
              <option value="">Alle Kanäle</option>
              {Object.entries(DEALER_CHANNEL_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="max-w-[140px]"
            >
              <option value="">Alle Status</option>
              {Object.entries(DEALER_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                  <th className="px-4 py-2.5 font-medium">Händler</th>
                  <th className="px-4 py-2.5 font-medium">Kanal</th>
                  <th className="px-4 py-2.5 font-medium">Land</th>
                  <th className="px-4 py-2.5 font-medium">Konditionen</th>
                  <th className="px-4 py-2.5 text-right font-medium">VK</th>
                  <th className="px-4 py-2.5 text-right font-medium">Chargen</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    Ø Marge
                  </th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ dealer, batchCount, avgMargin }) => (
                  <tr
                    key={dealer.id}
                    className="group border-b border-line last:border-b-0 hover:bg-surface-faint"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {dealer.name}
                      </p>
                      <p className="text-[12px] text-muted-soft">
                        {dealer.contactName || dealer.email || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {DEALER_CHANNEL_LABELS[dealer.channel]}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        {dealer.country ? (
                          <CountryFlag code={dealer.country} />
                        ) : null}
                        {countryName(dealer.country) || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {dealer.paymentTerms || "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {dealer.defaultSellPrice > 0
                        ? formatEuro(dealer.defaultSellPrice)
                        : "—"}
                      {dealer.salesCostItems.length > 0 ? (
                        <p className="text-[11px] text-muted-soft">
                          {dealer.salesCostItems.length} Kostenposten
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {batchCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {avgMargin != null ? (
                        <span
                          className={`tabular-nums ${
                            avgMargin >= 0 ? "text-success" : "text-danger"
                          }`}
                        >
                          {formatEuro(avgMargin)}
                        </span>
                      ) : (
                        <span className="text-muted-soft">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={dealer.status === "active" ? "success" : "neutral"}
                      >
                        {DEALER_STATUS_LABELS[dealer.status]}
                      </Badge>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex justify-end gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => setDraft(dealer)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          className="h-7 px-2"
                          onClick={() => setDeleteTarget(dealer)}
                        >
                          ×
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                Keine Treffer.
              </p>
            ) : null}
          </div>
          <p className="mt-3 text-[12px] text-muted-soft">
            {rows.length} von {data.dealers.length} Händler
            {data.dealers.length === 1 ? "" : "n"}
          </p>
        </>
      )}
    </div>
  );
}
