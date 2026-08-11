"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import type { Dealer, DealerChannel, DealerStatus } from "@/lib/types";
import { calculateResolvedEconomics } from "@/lib/resolve";
import { formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
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
  TableRowActions,
  TextInput,
} from "@/components/ui";

const DEALER_CHANNELS: DealerChannel[] = [
  "b2b",
  "retail",
  "marketplace",
  "online",
  "other",
];

const DEALER_STATUSES: DealerStatus[] = ["active", "inactive"];

export default function HaendlerPage() {
  const { ready, data, upsertDealer, deleteDealer } = useStore();
  const {
    t,
    locale,
    lang,
    dealerChannelLabel,
    dealerStatusLabel,
    countryLabel,
  } = useI18n();
  const [query, setQuery] = useState("");
  const [filterChannel, setFilterChannel] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [draft, setDraft] = useState<Dealer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dealer | null>(null);

  const channelLabel = dealerChannelLabel;
  const statusLabel = dealerStatusLabel;

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
          channelLabel(d.channel).toLowerCase().includes(q)
        );
      })
      .map((dealer) => {
        const linked = data.batches.filter((b) =>
          b.sales.some((s) => s.dealerId === dealer.id),
        );
        let marginSum = 0;
        let marginCount = 0;
        for (const batch of linked) {
          const econ = calculateResolvedEconomics(data, batch);
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
      .sort((a, b) => a.dealer.name.localeCompare(b.dealer.name, lang));
  }, [data.dealers, data.batches, query, filterChannel, filterStatus, channelLabel, lang]);

  if (!ready) return <p className="text-[13px] text-muted">{t("common.loading")}</p>;

  const isEdit = Boolean(draft && data.dealers.some((d) => d.id === draft.id));

  return (
    <div>
      <PageHeader
        title={t("dealers.title")}
        description={t("dealers.description")}
        action={
          <Button onClick={() => setDraft(emptyDealer())}>{t("dealers.add")}</Button>
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("dealers.deleteTitle")}
        description={
          deleteTarget
            ? t("dealers.deleteDescription", { name: deleteTarget.name })
            : ""
        }
        confirmLabel={t("common.deleteConfirm")}
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
          <p className="text-[13px] text-muted">{t("dealers.empty")}</p>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("dealers.search")}
              className="max-w-[220px]"
            />
            <Select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="max-w-[180px]"
            >
              <option value="">{t("dealers.allChannels")}</option>
              {DEALER_CHANNELS.map((k) => (
                <option key={k} value={k}>
                  {channelLabel(k)}
                </option>
              ))}
            </Select>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="max-w-[140px]"
            >
              <option value="">{t("dealers.allStatuses")}</option>
              {DEALER_STATUSES.map((k) => (
                <option key={k} value={k}>
                  {statusLabel(k)}
                </option>
              ))}
            </Select>
          </div>

          <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                  <th className="px-4 py-2.5 font-medium">{t("dealers.col.dealer")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("dealers.col.channel")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("dealers.col.country")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("dealers.col.terms")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t("dealers.col.vk")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t("dealers.col.batches")}</th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    {t("dealers.col.avgMargin")}
                  </th>
                  <th className="px-4 py-2.5 font-medium">{t("dealers.col.status")}</th>
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
                        {dealer.contactName || dealer.email || t("common.emDash")}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {channelLabel(dealer.channel)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        {dealer.country ? (
                          <CountryFlag code={dealer.country} />
                        ) : null}
                        {countryLabel(dealer.country) || t("common.emDash")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {dealer.paymentTerms || t("common.emDash")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {dealer.defaultSellPrice > 0
                        ? formatEuro(dealer.defaultSellPrice, locale)
                        : t("common.emDash")}
                      {dealer.salesCostItems.length > 0 ? (
                        <p className="text-[11px] text-muted-soft">
                          {t("dealers.costItems", {
                            count: dealer.salesCostItems.length,
                          })}
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
                          {formatEuro(avgMargin, locale)}
                        </span>
                      ) : (
                        <span className="text-muted-soft">{t("common.emDash")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={dealer.status === "active" ? "success" : "neutral"}
                      >
                        {statusLabel(dealer.status)}
                      </Badge>
                    </td>
                    <td className="px-2 py-3">
                      <TableRowActions
                        onEdit={() => setDraft(dealer)}
                        onDelete={() => setDeleteTarget(dealer)}
                        editLabel={t("dealers.action.edit")}
                        deleteLabel={t("common.delete")}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted">
                {t("dealers.noResults")}
              </p>
            ) : null}
          </div>
          <p className="mt-3 text-[12px] text-muted-soft">
            {t(
              data.dealers.length === 1 ? "dealers.count" : "dealers.count_plural",
              { count: rows.length, total: data.dealers.length },
            )}
          </p>
        </>
      )}
    </div>
  );
}
