"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import type { Product } from "@/lib/types";
import { formatDate, formatEuro, formatNumber, formatPercent } from "@/lib/format";
import { buildProductMetrics } from "@/lib/supplierRows";
import { useI18n } from "@/hooks/useI18n";
import { CountryFlag } from "@/components/CountryFlag";
import {
  ComponentFormModal,
  emptyComponent,
} from "@/components/ComponentFormModal";
import {
  Button,
  ConfirmDialog,
  PageHeader,
  Select,
  TextInput,
} from "@/components/ui";

export default function ComponentsPage() {
  const { ready, data, upsertProduct, deleteProduct } = useStore();
  const { t, plural, locale, lang, pricingUnitLabel } = useI18n();
  const [query, setQuery] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [draft, setDraft] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.products
      .filter((p) => {
        if (filterSupplier === "__none__") {
          if (p.supplierId) return false;
        } else if (filterSupplier && p.supplierId !== filterSupplier) {
          return false;
        }
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
        const metrics = buildProductMetrics(product.id, data);
        return { product, supplier, metrics };
      })
      .sort((a, b) => a.product.name.localeCompare(b.product.name, lang));
  }, [data, query, filterSupplier, lang]);

  if (!ready) return <p className="text-[13px] text-muted">{t("common.loading")}</p>;

  const isEdit = Boolean(draft && data.products.some((p) => p.id === draft.id));

  return (
    <div>
      <PageHeader
        title={t("components.title")}
        description={t("components.description")}
        action={
          <Button onClick={() => setDraft(emptyComponent())}>
            {t("components.add")}
          </Button>
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("components.deleteTitle")}
        description={
          deleteTarget
            ? t("components.deleteDescription", { name: deleteTarget.name })
            : ""
        }
        confirmLabel={t("common.deleteConfirm")}
        onConfirm={() => {
          if (deleteTarget) deleteProduct(deleteTarget.id);
        }}
      />

      <ComponentFormModal
        open={Boolean(draft)}
        initial={draft}
        suppliers={data.suppliers}
        isEdit={isEdit}
        onClose={() => setDraft(null)}
        onSave={(product) => {
          upsertProduct(product);
        }}
      />

      <div className="mb-3 flex flex-nowrap items-center gap-2 overflow-x-auto">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("components.searchPlaceholder")}
          className="!w-[260px] shrink-0"
        />
        {data.suppliers.length > 0 ? (
          <Select
            value={filterSupplier}
            onChange={(e) => setFilterSupplier(e.target.value)}
            className="!w-[200px] shrink-0"
          >
            <option value="">{t("components.allSuppliers")}</option>
            <option value="__none__">{t("components.noSupplierFilter")}</option>
            {data.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        ) : null}
        <p className="ml-auto shrink-0 text-[12px] text-muted-soft">
          {plural(rows.length, "components.count", "components.count_plural")}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-line px-4 py-10 text-center text-[13px] text-muted">
          {t("components.empty")}
        </div>
      ) : (
            <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                      <th className="px-4 py-2.5 font-medium">
                        {t("components.col.product")}
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        {t("components.col.sku")}
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        {t("components.col.supplier")}
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        {t("components.col.price")}
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        {t("components.col.moq")}
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        {t("components.col.avgLanded")}
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        {t("components.col.batches")}
                      </th>
                      <th className="px-4 py-2.5 font-medium">
                        {t("components.col.lastOrder")}
                      </th>
                      <th className="px-4 py-2.5 text-right font-medium">
                        {t("components.col.avgMargin")}
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
                          {product.sku || t("common.emDash")}
                        </td>
                        <td className="px-4 py-3">
                          {supplier ? (
                            <span className="inline-flex items-center gap-2 text-muted">
                              <CountryFlag code={supplier.country} />
                              {supplier.name}
                            </span>
                          ) : (
                            t("common.emDash")
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {t("components.priceWithUnit", {
                            price: formatEuro(product.unitPrice, locale),
                            unit: pricingUnitLabel(product.pricingUnit),
                          })}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {t("components.moqWithUnit", {
                            count: formatNumber(product.moq, locale),
                            unit: pricingUnitLabel(product.pricingUnit),
                          })}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {metrics.avgLandedCost != null
                            ? formatEuro(metrics.avgLandedCost, locale)
                            : t("common.emDash")}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted">
                          {metrics.batchCount}
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {formatDate(metrics.lastOrderAt, locale)}
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
                              {formatEuro(metrics.avgMarginEuro, locale)}
                              <span className="ml-1 text-[12px] text-muted-soft">
                                {formatPercent(
                                  metrics.avgMarginPercent ?? 0,
                                  locale,
                                )}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-soft">
                              {t("common.emDash")}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex justify-end gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                            <Link href={`/batches?new=1&product=${product.id}`}>
                              <Button variant="ghost" className="h-7 px-2">
                                {t("components.action.batch")}
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={() => setDraft(product)}
                            >
                              {t("components.action.edit")}
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
