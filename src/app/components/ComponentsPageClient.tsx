"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import type { Component } from "@/lib/types";
import { formatEuro } from "@/lib/format";
import { useI18n } from "@/hooks/useI18n";
import { CountryFlag } from "@/components/CountryFlag";
import {
  ComponentFormModal,
  type ComponentFormSave,
} from "@/components/ComponentFormModal";
import {
  Button,
  ConfirmDialog,
  PageHeader,
  Select,
  TextInput,
} from "@/components/ui";

export default function ComponentsPage() {
  const {
    ready,
    data,
    upsertComponent,
    upsertProductComponent,
    deleteComponent,
    linkedProductNamesForComponent,
  } = useStore();
  const { t, plural, locale, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [draft, setDraft] = useState<Component | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteBlocked, setDeleteBlocked] = useState<{
    name: string;
    products: string[];
  } | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const links = data.productComponents ?? [];
    return data.components
      .map((component) => {
        const supplier = data.suppliers.find(
          (s) => s.id === component.supplierId,
        );
        const componentLinks = links.filter(
          (pc) => pc.componentId === component.id,
        );
        const productCount = new Set(componentLinks.map((pc) => pc.productId))
          .size;
        const totalQty = componentLinks.reduce(
          (sum, pc) => sum + Math.max(pc.quantityPerProductUnit, 0),
          0,
        );
        return { component, supplier, productCount, totalQty };
      })
      .filter(({ component, supplier }) => {
        if (filterSupplier === "__none__") {
          if (component.supplierId) return false;
        } else if (filterSupplier && component.supplierId !== filterSupplier) {
          return false;
        }
        if (!q) return true;
        return (
          component.name.toLowerCase().includes(q) ||
          component.sku.toLowerCase().includes(q) ||
          (supplier?.name.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => a.component.name.localeCompare(b.component.name, lang));
  }, [data, query, filterSupplier, lang]);

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  const isEdit = Boolean(
    draft && data.components.some((c) => c.id === draft.id),
  );

  function openCreate() {
    setDraft(null);
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

  function handleSave(result: ComponentFormSave) {
    upsertComponent(result.component);
    if (result.link.productId) {
      const existing = (data.productComponents ?? []).find(
        (pc) =>
          pc.productId === result.link.productId &&
          pc.componentId === result.component.id,
      );
      upsertProductComponent(
        existing ? { ...result.link, id: existing.id } : result.link,
      );
    }
    closeModal();
  }

  function tryDelete(component: Component) {
    const products = linkedProductNamesForComponent(component.id);
    if (products.length > 0) {
      setDeleteBlocked({ name: component.name, products });
      return;
    }
    deleteComponent(component.id);
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
        onSave={handleSave}
      />

      <ConfirmDialog
        open={Boolean(deleteBlocked)}
        onClose={() => setDeleteBlocked(null)}
        title={t("components.deleteBlockedTitle")}
        description={
          deleteBlocked
            ? t("components.deleteBlockedDescription", {
                name: deleteBlocked.name,
                products: deleteBlocked.products.join(", "),
              })
            : ""
        }
        confirmLabel={t("common.close")}
        danger={false}
        onConfirm={() => setDeleteBlocked(null)}
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
                    {t("components.col.sku")}
                  </th>
                  <th className="px-4 py-2.5 font-medium">
                    {t("components.col.supplier")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    {t("productModal.componentPrice")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    {t("components.col.products")}
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium">
                    {t("components.col.totalQty")}
                  </th>
                  <th className="w-28 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ component, supplier, productCount, totalQty }) => (
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
                    <td className="px-4 py-3 tabular-nums text-muted">
                      {component.sku || t("common.emDash")}
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
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {productCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {totalQty}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex justify-end gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => openEdit(component)}
                        >
                          {t("components.action.edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-7 px-2 text-danger"
                          onClick={() => tryDelete(component)}
                        >
                          {t("common.delete")}
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

      <p className="mt-3 text-[12px] text-muted-soft">
        <Link href="/products" className="hover:text-accent">
          {t("components.hintProducts")}
        </Link>
      </p>
    </div>
  );
}
