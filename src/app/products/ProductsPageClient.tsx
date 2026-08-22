"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/context/StoreContext";
import type { CatalogProduct, Component, ProductComponent } from "@/lib/types";
import { formatEuro } from "@/lib/format";
import { catalogProductUnitPurchaseCost } from "@/lib/migrateAppData";
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
  TableRowActions,
  TextInput,
} from "@/components/ui";

type SortKey =
  | "product"
  | "sku"
  | "category"
  | "purchase"
  | "listPrice"
  | "unit"
  | "status";
type SortDir = "asc" | "desc";

function SortTh({
  label,
  active,
  dir,
  onClick,
  align,
  className = "",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "right";
  className?: string;
}) {
  return (
    <th className={`px-4 py-2.5 font-medium ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          align === "right" ? "w-full justify-end" : ""
        } ${active ? "text-foreground" : ""}`}
      >
        {label}
        <span className="text-[10px] text-muted-soft">
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

export default function ProductsPageClient() {
  const {
    ready,
    data,
    upsertCatalogProduct,
    upsertComponent,
    upsertProductComponent,
    deleteProductComponent,
    deleteCatalogProduct,
  } = useStore();
  const { t, plural, locale, lang, pricingUnitLabel } = useI18n();
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("product");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [draft, setDraft] = useState<CatalogProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogProduct | null>(
    null,
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = data.catalogProducts.filter((p) => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "product") {
        cmp = a.name.localeCompare(b.name, lang);
      } else if (sortKey === "sku") {
        cmp = (a.sku || "").localeCompare(b.sku || "", lang);
      } else if (sortKey === "category") {
        cmp = (a.category || "").localeCompare(b.category || "", lang);
      } else if (sortKey === "purchase") {
        const pa = catalogProductUnitPurchaseCost(
          a.id,
          data.components,
          data.productComponents ?? [],
        );
        const pb = catalogProductUnitPurchaseCost(
          b.id,
          data.components,
          data.productComponents ?? [],
        );
        cmp = pa - pb;
      } else if (sortKey === "listPrice") {
        const pa = a.listPrice ?? Number.NEGATIVE_INFINITY;
        const pb = b.listPrice ?? Number.NEGATIVE_INFINITY;
        cmp = pa - pb;
      } else if (sortKey === "unit") {
        cmp = a.pricingUnit.localeCompare(b.pricingUnit, lang);
      } else {
        cmp = a.status.localeCompare(b.status, lang);
      }
      if (cmp !== 0) return cmp * dir;
      return a.name.localeCompare(b.name, lang) * dir;
    });
  }, [
    data.catalogProducts,
    data.components,
    data.productComponents,
    query,
    filterStatus,
    lang,
    sortKey,
    sortDir,
  ]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(
        key === "purchase" || key === "listPrice" ? "desc" : "asc",
      );
    }
  }

  function saveProduct(
    product: CatalogProduct,
    components: Component[],
    links: ProductComponent[],
  ) {
    upsertCatalogProduct(product);
    for (const c of components) {
      upsertComponent(c);
    }
    const existingLinks = (data.productComponents ?? []).filter(
      (pc) => pc.productId === product.id,
    );
    const nextIds = new Set(links.map((l) => l.id));
    for (const link of existingLinks) {
      if (!nextIds.has(link.id)) deleteProductComponent(link.id);
    }
    for (const link of links) {
      upsertProductComponent(link);
    }
  }

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
        data={data}
        onClose={() => setDraft(null)}
        onSave={saveProduct}
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
                  <SortTh
                    label={t("products.col.product")}
                    active={sortKey === "product"}
                    dir={sortDir}
                    onClick={() => toggleSort("product")}
                  />
                  <SortTh
                    label={t("products.col.sku")}
                    active={sortKey === "sku"}
                    dir={sortDir}
                    onClick={() => toggleSort("sku")}
                  />
                  <SortTh
                    label={t("products.col.category")}
                    active={sortKey === "category"}
                    dir={sortDir}
                    onClick={() => toggleSort("category")}
                  />
                  <SortTh
                    label={t("products.col.purchase")}
                    active={sortKey === "purchase"}
                    dir={sortDir}
                    onClick={() => toggleSort("purchase")}
                    align="right"
                  />
                  <SortTh
                    label={t("products.col.listPrice")}
                    active={sortKey === "listPrice"}
                    dir={sortDir}
                    onClick={() => toggleSort("listPrice")}
                    align="right"
                  />
                  <SortTh
                    label={t("products.col.unit")}
                    active={sortKey === "unit"}
                    dir={sortDir}
                    onClick={() => toggleSort("unit")}
                    className="hidden md:table-cell"
                  />
                  <SortTh
                    label={t("products.col.status")}
                    active={sortKey === "status"}
                    dir={sortDir}
                    onClick={() => toggleSort("status")}
                  />
                  <th className="w-28 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((product) => {
                  const purchase = catalogProductUnitPurchaseCost(
                    product.id,
                    data.components,
                    data.productComponents ?? [],
                  );
                  const componentCount = (data.productComponents ?? []).filter(
                    (pc) => pc.productId === product.id,
                  ).length;
                  return (
                    <tr
                      key={product.id}
                      className="group border-b border-line last:border-0 hover:bg-surface-faint"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/products/${product.id}`}
                          className="text-left font-medium text-foreground hover:text-accent"
                        >
                          {product.name}
                        </Link>
                        <p className="text-[11px] text-muted-soft">
                          {t("products.componentCount", {
                            count: String(componentCount),
                          })}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {product.sku || t("common.emDash")}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {product.category || t("common.emDash")}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatEuro(purchase, locale)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {product.listPrice != null
                          ? formatEuro(product.listPrice, locale)
                          : t("common.emDash")}
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
                      <td className="px-2 py-3">
                        <TableRowActions
                          onEdit={() => setDraft(product)}
                          onDelete={() => setDeleteTarget(product)}
                          editLabel={t("products.action.edit")}
                          deleteLabel={t("common.delete")}
                        />
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
