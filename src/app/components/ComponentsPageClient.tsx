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
  TableRowActions,
  TextInput,
} from "@/components/ui";
import { CosterraWholesaleRedirect } from "@/components/CosterraWholesaleRedirect";
import { usePrefs } from "@/context/PreferencesContext";
import { isCosterraWholesale } from "@/lib/costerraMode";

type SortKey =
  | "name"
  | "sku"
  | "supplier"
  | "price"
  | "products"
  | "totalQty";

export default function ComponentsPage() {
  const { ready: prefsReady, prefs } = usePrefs();
  if (!prefsReady) {
    return <p className="px-4 py-8 text-sm text-muted">…</p>;
  }
  if (isCosterraWholesale(prefs)) {
    return <CosterraWholesaleRedirect to="/products" />;
  }
  return <ComponentsPageInner />;
}

function ComponentsPageInner() {
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
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const links = data.productComponents ?? [];
    const filtered = data.components
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
      });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.component.name.localeCompare(b.component.name, lang) * dir;
        case "sku":
          return (
            (a.component.sku || "").localeCompare(b.component.sku || "", lang) *
            dir
          );
        case "supplier":
          return (
            (a.supplier?.name || "").localeCompare(
              b.supplier?.name || "",
              lang,
            ) * dir
          );
        case "price":
          return (
            (a.component.purchasePricePerUnit -
              b.component.purchasePricePerUnit) *
            dir
          );
        case "products":
          return (a.productCount - b.productCount) * dir;
        case "totalQty":
          return (a.totalQty - b.totalQty) * dir;
        default:
          return 0;
      }
    });
  }, [data, query, filterSupplier, lang, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(
        key === "price" || key === "products" || key === "totalQty"
          ? "desc"
          : "asc",
      );
    }
  }

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
                  <SortTh
                    label={t("productModal.componentName")}
                    active={sortKey === "name"}
                    dir={sortDir}
                    onClick={() => toggleSort("name")}
                  />
                  <SortTh
                    label={t("components.col.sku")}
                    active={sortKey === "sku"}
                    dir={sortDir}
                    onClick={() => toggleSort("sku")}
                  />
                  <SortTh
                    label={t("components.col.supplier")}
                    active={sortKey === "supplier"}
                    dir={sortDir}
                    onClick={() => toggleSort("supplier")}
                  />
                  <SortTh
                    label={t("productModal.componentPrice")}
                    active={sortKey === "price"}
                    dir={sortDir}
                    align="right"
                    onClick={() => toggleSort("price")}
                  />
                  <SortTh
                    label={t("components.col.products")}
                    active={sortKey === "products"}
                    dir={sortDir}
                    align="right"
                    onClick={() => toggleSort("products")}
                  />
                  <SortTh
                    label={t("components.col.totalQty")}
                    active={sortKey === "totalQty"}
                    dir={sortDir}
                    align="right"
                    onClick={() => toggleSort("totalQty")}
                  />
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
                      <TableRowActions
                        onEdit={() => openEdit(component)}
                        onDelete={() => tryDelete(component)}
                        editLabel={t("components.action.edit")}
                        deleteLabel={t("common.delete")}
                      />
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

function SortTh({
  label,
  active,
  dir,
  align = "left",
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <th
      className={`px-4 py-2.5 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
          active ? "text-foreground" : "text-muted-soft"
        } ${align === "right" ? "ml-auto" : ""}`}
      >
        {label}
        <span className="text-[10px] tabular-nums" aria-hidden>
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}
