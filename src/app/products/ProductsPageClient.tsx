"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/context/StoreContext";
import type { CatalogProduct } from "@/lib/types";
import { formatEuro, formatPercent } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { useI18n } from "@/hooks/useI18n";
import {
  CatalogProductFormModal,
  emptyCatalogProduct,
} from "@/components/CatalogProductFormModal";
import {
  Badge,
  Button,
  ConfirmDialog,
  PageHeader,
  Select,
  TextInput,
} from "@/components/ui";

export default function ProductsPageClient() {
  const { ready, data, upsertCatalogProduct, deleteCatalogProduct } =
    useStore();
  const { t, plural, locale, lang, pricingUnitLabel } = useI18n();
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [draft, setDraft] = useState<CatalogProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogProduct | null>(
    null,
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.catalogProducts
      .filter((p) => {
        if (filterStatus && p.status !== filterStatus) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  }, [data.catalogProducts, query, filterStatus, lang]);

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  const isEdit = Boolean(
    draft && data.catalogProducts.some((p) => p.id === draft.id),
  );

  return (
    <div>
      <PageHeader
        title={t("products.title")}
        description={t("products.description")}
        action={
          <Button onClick={() => setDraft(emptyCatalogProduct())}>
            {t("products.add")}
          </Button>
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("products.deleteTitle")}
        description={
          deleteTarget
            ? t("products.deleteDescription", { name: deleteTarget.name })
            : ""
        }
        confirmLabel={t("common.deleteConfirm")}
        onConfirm={() => {
          if (deleteTarget) deleteCatalogProduct(deleteTarget.id);
        }}
      />

      <CatalogProductFormModal
        open={Boolean(draft)}
        initial={draft}
        isEdit={isEdit}
        onClose={() => setDraft(null)}
        onSave={(product) => upsertCatalogProduct(product)}
      />

      <div className="mb-3 flex flex-nowrap items-center gap-2 overflow-x-auto">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("products.searchPlaceholder")}
          className="!w-[260px] shrink-0"
        />
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="!w-[160px] shrink-0"
        >
          <option value="">{t("products.allStatuses")}</option>
          <option value="active">{t("products.status.active")}</option>
          <option value="inactive">{t("products.status.inactive")}</option>
        </Select>
        <p className="ml-auto shrink-0 text-[12px] text-muted-soft">
          {plural(rows.length, "products.count", "products.count_plural")}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-muted">
          {t("products.empty")}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                  <th className="px-4 py-2.5 font-medium">
                    {t("products.col.product")}
                  </th>
                  <th className="px-4 py-2.5 font-medium">
                    {t("products.col.sku")}
                  </th>
                  <th className="px-4 py-2.5 font-medium">
                    {t("products.col.category")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    {t("products.col.price")}
                  </th>
                  <th className="hidden px-4 py-2.5 font-medium md:table-cell">
                    {t("products.col.unit")}
                  </th>
                  <th className="px-4 py-2.5 font-medium">
                    {t("products.col.status")}
                  </th>
                  <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">
                    {t("products.col.targetMargin")}
                  </th>
                  <th className="w-28 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => (
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
                      {product.sku || t("common.emDash")}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {product.category || t("common.emDash")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatEuro(product.sellPrice, locale)}
                      <span className="ml-1 text-[11px] text-muted-soft">
                        {product.currency}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">
                      {pricingUnitLabel(product.pricingUnit)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          product.status === "active" ? "success" : "neutral"
                        }
                      >
                        {t(
                          `products.status.${product.status}` as MessageKey,
                        )}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums text-muted lg:table-cell">
                      {product.targetMarginPercent != null
                        ? formatPercent(product.targetMarginPercent, locale)
                        : t("common.emDash")}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex justify-end gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => setDraft(product)}
                        >
                          {t("products.action.edit")}
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
    </div>
  );
}
