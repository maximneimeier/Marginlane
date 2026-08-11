"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import type { Component } from "@/lib/types";
import { formatEuro } from "@/lib/format";
import { buildProductMetrics } from "@/lib/supplierRows";
import { useI18n } from "@/hooks/useI18n";
import { CountryFlag } from "@/components/CountryFlag";
import {
  ComponentFormModal,
  emptyBomComponent,
} from "@/components/ComponentFormModal";
import {
  Button,
  PageHeader,
  Select,
  TextInput,
} from "@/components/ui";

export default function ComponentsPage() {
  const { ready, data, upsertComponent } = useStore();
  const { t, plural, locale, lang, pricingUnitLabel } = useI18n();
  const [query, setQuery] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [draft, setDraft] = useState<Component | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.components
      .map((component) => {
        const product = data.catalogProducts.find(
          (p) => p.id === component.productId,
        );
        const supplier = data.suppliers.find(
          (s) => s.id === component.supplierId,
        );
        return { component, product, supplier };
      })
      .filter(({ component, product, supplier }) => {
        if (filterSupplier === "__none__") {
          if (component.supplierId) return false;
        } else if (filterSupplier && component.supplierId !== filterSupplier) {
          return false;
        }
        if (!q) return true;
        return (
          component.name.toLowerCase().includes(q) ||
          (product?.name.toLowerCase().includes(q) ?? false) ||
          (product?.sku.toLowerCase().includes(q) ?? false) ||
          (supplier?.name.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => {
        const nameA = a.component.name || a.product?.name || "";
        const nameB = b.component.name || b.product?.name || "";
        return nameA.localeCompare(nameB, lang);
      });
  }, [data, query, filterSupplier, lang]);

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  const isEdit = Boolean(
    draft && data.components.some((c) => c.id === draft.id),
  );

  function openCreate() {
    setDraft(
      emptyBomComponent(
        data.catalogProducts[0]?.id ?? "",
        data.suppliers[0]?.id ?? "",
      ),
    );
    setModalOpen(true);
  }

  function openEdit(component: Component) {
    setDraft(structuredClone(component));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setDraft(null);
  }

  return (
    <div>
      <PageHeader
        title={t("components.title")}
        description={t("components.description")}
        action={
          <Button onClick={openCreate}>{t("components.add")}</Button>
        }
      />

      <ComponentFormModal
        open={modalOpen}
        initial={draft}
        data={data}
        isEdit={isEdit}
        onClose={closeModal}
        onSave={(component) => {
          upsertComponent(component);
          closeModal();
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
                    {t("productModal.componentName")}
                  </th>
                  <th className="px-4 py-2.5 font-medium">
                    {t("components.col.product")}
                  </th>
                  <th className="px-4 py-2.5 font-medium">
                    {t("components.col.supplier")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    {t("productModal.componentPrice")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    {t("productModal.componentQty")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    {t("products.col.batches")}
                  </th>
                  <th className="w-24 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ component, product, supplier }) => {
                  const metrics = product
                    ? buildProductMetrics(product.id, data)
                    : null;
                  const unit = product
                    ? pricingUnitLabel(product.pricingUnit)
                    : pricingUnitLabel("pcs");
                  return (
                    <tr
                      key={component.id}
                      className="group border-b border-line last:border-0 hover:bg-surface-faint"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => openEdit(component)}
                          className="text-left font-medium text-foreground hover:text-accent"
                        >
                          {component.name || t("common.emDash")}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {product ? (
                          <Link
                            href="/products"
                            className="hover:text-accent"
                          >
                            {product.name}
                          </Link>
                        ) : (
                          t("common.emDash")
                        )}
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
                        {formatEuro(component.purchasePricePerUnit, locale)}
                        <span className="ml-1 text-[11px] text-muted-soft">
                          / {unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {component.quantityPerProductUnit}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted">
                        {metrics?.batchCount ?? 0}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                          {product ? (
                            <Link
                              href={`/batches?new=1&product=${product.id}`}
                            >
                              <Button variant="ghost" className="h-7 px-2">
                                {t("components.action.batch")}
                              </Button>
                            </Link>
                          ) : null}
                          <Button
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => openEdit(component)}
                          >
                            {t("components.action.edit")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
