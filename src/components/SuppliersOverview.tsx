"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Component, Supplier } from "@/lib/types";
import { INCOTERMS, type SupplierStatus } from "@/lib/types";
import { CountryFlag } from "@/components/CountryFlag";
import { formatDate, formatEuro, formatPercent } from "@/lib/format";
import {
  buildProductMetrics,
  buildSupplierRows,
  sortRows,
  type OptionalColumn,
  type SortKey,
  type SupplierRow,
} from "@/lib/supplierRows";
import type { AppData } from "@/lib/types";
import { useI18n } from "@/hooks/useI18n";
import {
  Badge,
  Button,
  ConfirmDialog,
  TextInput,
  Select,
} from "@/components/ui";

const PAGE_SIZE = 50;
const COLS_KEY = "landed-cost-supplier-cols";

type ViewMode = "table" | "cards";

type Props = {
  data: AppData;
  onCreate: () => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  onAddProduct: (supplierId: string) => void;
  onEditProduct: (component: Component) => void;
  onClearData: () => void;
  componentsOf: (supplierId: string) => Component[];
  addProductHref?: string;
};

export function SuppliersOverview({
  data,
  onCreate,
  onEdit,
  onDelete,
  onAddProduct,
  onEditProduct,
  onClearData,
  componentsOf,
  addProductHref,
}: Props) {
  const { t, plural, locale, supplierStatusLabel, optionalColLabel, countryLabel, pricingUnitLabel } =
    useI18n();
  const [view, setView] = useState<ViewMode>("table");
  const [query, setQuery] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterIncoterm, setFilterIncoterm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);
  const [optionalCols, setOptionalCols] = useState<OptionalColumn[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLS_KEY);
      if (raw) setOptionalCols(JSON.parse(raw) as OptionalColumn[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(COLS_KEY, JSON.stringify(optionalCols));
  }, [optionalCols]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!colsRef.current?.contains(e.target as Node)) setColsOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const rows = useMemo(() => buildSupplierRows(data), [data]);

  const countriesInData = useMemo(() => {
    const codes = [...new Set(rows.map((r) => r.supplier.country).filter(Boolean))];
    return codes.sort((a, b) =>
      countryLabel(a).localeCompare(countryLabel(b), locale),
    );
  }, [rows, countryLabel, locale]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((row) => {
      const s = row.supplier;
      if (filterCountry && s.country !== filterCountry) return false;
      if (filterStatus && s.status !== filterStatus) return false;
      if (filterIncoterm && s.incoterm !== filterIncoterm) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.contactName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    });
    list = sortRows(list, sortKey, sortDir);
    return list;
  }, [
    rows,
    query,
    filterCountry,
    filterStatus,
    filterIncoterm,
    sortKey,
    sortDir,
  ]);

  useEffect(() => {
    setPage(1);
  }, [query, filterCountry, filterStatus, filterIncoterm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleCol(col: OptionalColumn) {
    setOptionalCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  }

  const hasOptional = (col: OptionalColumn) => optionalCols.includes(col);

  return (
    <div>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={t("suppliers.deleteTitle")}
        description={
          deleteTarget
            ? t("suppliers.deleteDescription", { name: deleteTarget.name })
            : ""
        }
        confirmLabel={t("common.deleteConfirm")}
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget);
        }}
      />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">
            {t("suppliers.title")}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {filtered.length === rows.length
              ? plural(rows.length, "suppliers.count", "suppliers.count_plural")
              : t("suppliers.countFiltered", {
                  count: filtered.length,
                  total: rows.length,
                })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-[8px] border border-line bg-white p-0.5">
            <button
              type="button"
              onClick={() => setView("table")}
              className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
                view === "table"
                  ? "bg-surface-soft text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t("suppliers.view.table")}
            </button>
            <button
              type="button"
              onClick={() => setView("cards")}
              className={`rounded-[6px] px-2.5 py-1 text-[12px] font-medium ${
                view === "cards"
                  ? "bg-surface-soft text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {t("suppliers.view.cards")}
            </button>
          </div>
          <Button variant="secondary" onClick={onClearData}>
            {t("suppliers.clearData")}
          </Button>
          <Button onClick={onCreate}>{t("suppliers.add")}</Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-line px-6 py-14 text-center">
          <p className="text-[15px] font-medium text-foreground">
            {t("suppliers.emptyTitle")}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {t("suppliers.emptyHint")}
          </p>
          <Button className="mt-5" onClick={onCreate}>
            {t("suppliers.emptyCta")}
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-nowrap items-center gap-2 overflow-x-auto pb-0.5">
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("suppliers.searchPlaceholder")}
              className="!w-[220px] shrink-0"
            />
            <Select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="!w-[150px] shrink-0"
            >
              <option value="">{t("suppliers.allCountries")}</option>
              {countriesInData.map((code) => (
                <option key={code} value={code}>
                  {countryLabel(code)}
                </option>
              ))}
            </Select>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="!w-[130px] shrink-0"
            >
              <option value="">{t("suppliers.allStatuses")}</option>
              {(["active", "inactive", "review"] as SupplierStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {supplierStatusLabel(s)}
                  </option>
                ),
              )}
            </Select>
            <Select
              value={filterIncoterm}
              onChange={(e) => setFilterIncoterm(e.target.value)}
              className="!w-[140px] shrink-0"
            >
              <option value="">{t("suppliers.allIncoterms")}</option>
              {INCOTERMS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>

            <div className="relative ml-auto shrink-0" ref={colsRef}>
              <Button
                variant="secondary"
                onClick={() => setColsOpen((v) => !v)}
              >
                {t("suppliers.columns")}
              </Button>
              {colsOpen ? (
                <div className="absolute right-0 z-20 mt-1 w-52 rounded-[10px] border border-line bg-white p-2 shadow-[0_12px_40px_rgba(28,29,31,0.12)]">
                  <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                    {t("suppliers.optionalColumns")}
                  </p>
                  {(Object.keys({
                    contactName: true,
                    paymentDays: true,
                    skonto: true,
                    taxId: true,
                  }) as OptionalColumn[]).map((col) => (
                    <label
                      key={col}
                      className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-[13px] hover:bg-surface-faint"
                    >
                      <input
                        type="checkbox"
                        checked={hasOptional(col)}
                        onChange={() => toggleCol(col)}
                        className="accent-[var(--accent)]"
                      />
                      {optionalColLabel(col)}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-[12px] border border-line bg-white px-4 py-10 text-center text-[13px] text-muted">
              {t("suppliers.noFilterResults")}
            </div>
          ) : view === "cards" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pageRows.map((row) => (
                <SupplierCard
                  key={row.supplier.id}
                  row={row}
                  onEdit={() => onEdit(row.supplier)}
                  onDelete={() => setDeleteTarget(row.supplier)}
                  onOpen={() =>
                    setExpandedId(
                      expandedId === row.supplier.id ? null : row.supplier.id,
                    )
                  }
                  expanded={expandedId === row.supplier.id}
                  components={componentsOf(row.supplier.id)}
                  data={data}
                  addProductHref={addProductHref}
                  onAddProduct={() => onAddProduct(row.supplier.id)}
                  onEditProduct={onEditProduct}
                  countryLabel={countryLabel}
                  supplierStatusLabel={supplierStatusLabel}
                  locale={locale}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[12px] border border-line bg-white shadow-[var(--shadow-sm)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-surface-faint text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                      <SortTh
                        label={t("suppliers.col.company")}
                        active={sortKey === "name"}
                        dir={sortDir}
                        onClick={() => toggleSort("name")}
                      />
                      <SortTh
                        label={t("suppliers.col.country")}
                        active={sortKey === "country"}
                        dir={sortDir}
                        onClick={() => toggleSort("country")}
                        className="hidden sm:table-cell"
                      />
                      <SortTh
                        label={t("suppliers.col.products")}
                        active={sortKey === "productCount"}
                        dir={sortDir}
                        onClick={() => toggleSort("productCount")}
                        align="right"
                        className="hidden md:table-cell"
                      />
                      <SortTh
                        label={t("suppliers.col.avgLanded")}
                        active={sortKey === "avgLandedCost"}
                        dir={sortDir}
                        onClick={() => toggleSort("avgLandedCost")}
                        align="right"
                        className="hidden lg:table-cell"
                      />
                      <SortTh
                        label={t("suppliers.col.lastOrder")}
                        active={sortKey === "lastOrderAt"}
                        dir={sortDir}
                        onClick={() => toggleSort("lastOrderAt")}
                        className="hidden lg:table-cell"
                      />
                      <SortTh
                        label={t("suppliers.col.incoterm")}
                        active={sortKey === "incoterm"}
                        dir={sortDir}
                        onClick={() => toggleSort("incoterm")}
                        className="hidden md:table-cell"
                      />
                      <SortTh
                        label={t("suppliers.col.status")}
                        active={sortKey === "status"}
                        dir={sortDir}
                        onClick={() => toggleSort("status")}
                      />
                      {hasOptional("contactName") ? (
                        <SortTh
                          label={optionalColLabel("contactName")}
                          active={sortKey === "contactName"}
                          dir={sortDir}
                          onClick={() => toggleSort("contactName")}
                          className="hidden xl:table-cell"
                        />
                      ) : null}
                      {hasOptional("paymentDays") ? (
                        <SortTh
                          label={optionalColLabel("paymentDays")}
                          active={sortKey === "paymentDays"}
                          dir={sortDir}
                          onClick={() => toggleSort("paymentDays")}
                          className="hidden xl:table-cell"
                        />
                      ) : null}
                      {hasOptional("skonto") ? (
                        <SortTh
                          label={optionalColLabel("skonto")}
                          active={sortKey === "skonto"}
                          dir={sortDir}
                          onClick={() => toggleSort("skonto")}
                          className="hidden xl:table-cell"
                        />
                      ) : null}
                      {hasOptional("taxId") ? (
                        <th className="hidden px-3 py-2.5 font-medium xl:table-cell">
                          {optionalColLabel("taxId")}
                        </th>
                      ) : null}
                      <th className="w-28 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => {
                      const s = row.supplier;
                      const open = expandedId === s.id;
                      return (
                        <FragmentRow key={s.id}>
                          <tr className="group border-b border-line last:border-0 hover:bg-surface-faint">
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="text-muted-soft sm:hidden"
                                  onClick={() =>
                                    setExpandedId(open ? null : s.id)
                                  }
                                  aria-label={t("suppliers.action.details")}
                                >
                                  <Chevron open={open} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedId(open ? null : s.id)
                                  }
                                  className="text-left font-medium text-foreground hover:text-accent"
                                >
                                  {s.name}
                                </button>
                              </div>
                              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-soft sm:hidden">
                                <CountryFlag code={s.country} />
                                {countryLabel(s.country)}
                              </p>
                            </td>
                            <td className="hidden px-3 py-2.5 sm:table-cell">
                              <span className="inline-flex items-center gap-2">
                                <CountryFlag
                                  code={s.country}
                                  title={countryLabel(s.country)}
                                />
                                <span className="text-muted">
                                  {countryLabel(s.country)}
                                </span>
                              </span>
                            </td>
                            <td className="hidden px-3 py-2.5 text-right tabular-nums text-muted md:table-cell">
                              {row.productCount}
                            </td>
                            <td className="hidden px-3 py-2.5 text-right tabular-nums lg:table-cell">
                              {row.avgLandedCost != null
                                ? formatEuro(row.avgLandedCost)
                                : "—"}
                            </td>
                            <td className="hidden px-3 py-2.5 text-muted lg:table-cell">
                              {formatDate(row.lastOrderAt, locale)}
                            </td>
                            <td className="hidden px-3 py-2.5 tabular-nums text-muted md:table-cell">
                              {s.incoterm || "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              <StatusBadge status={s.status} label={supplierStatusLabel(s.status)} />
                            </td>
                            {hasOptional("contactName") ? (
                              <td className="hidden px-3 py-2.5 text-muted xl:table-cell">
                                {s.contactName || t("common.emDash")}
                              </td>
                            ) : null}
                            {hasOptional("paymentDays") ? (
                              <td className="hidden px-3 py-2.5 text-muted xl:table-cell">
                                {s.paymentDays}{" "}
                                {s.paymentUnit === "Wochen"
                                  ? t("paymentUnit.Wochen")
                                  : t("paymentUnit.Tage")}
                              </td>
                            ) : null}
                            {hasOptional("skonto") ? (
                              <td className="hidden px-3 py-2.5 text-muted xl:table-cell">
                                {s.skontoPercent > 0
                                  ? `${s.skontoPercent}% / ${s.skontoDays} ${t("common.daysShort")}`
                                  : t("common.emDash")}
                              </td>
                            ) : null}
                            {hasOptional("taxId") ? (
                              <td className="hidden px-3 py-2.5 text-muted xl:table-cell">
                                {s.taxId || "—"}
                              </td>
                            ) : null}
                            <td className="px-2 py-2.5">
                              <div className="flex justify-end gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                <IconBtn
                                  title={t("common.edit")}
                                  onClick={() => onEdit(s)}
                                >
                                  ✎
                                </IconBtn>
                                <IconBtn
                                  title={t("common.delete")}
                                  danger
                                  onClick={() => setDeleteTarget(s)}
                                >
                                  ×
                                </IconBtn>
                              </div>
                            </td>
                          </tr>
                          {open ? (
                            <tr className="border-b border-line bg-surface-faint">
                              <td colSpan={99} className="p-0">
                                <MobileExtras row={row} locale={locale} />
                                <ExpandedComponents
                                  components={componentsOf(s.id)}
                                  data={data}
                                  addProductHref={addProductHref}
                                  onAddProduct={() => onAddProduct(s.id)}
                                  onEditProduct={onEditProduct}
                                  locale={locale}
                                />
                              </td>
                            </tr>
                          ) : null}
                        </FragmentRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
              <span>
                {t("common.pageOf", { page, total: totalPages })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("common.back")}
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("common.next")}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

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
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "right";
  className?: string;
}) {
  return (
    <th className={`px-3 py-2.5 font-medium ${className}`}>
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

function StatusBadge({
  status,
  label,
}: {
  status: SupplierStatus;
  label: string;
}) {
  const tone =
    status === "active" ? "success" : status === "review" ? "accent" : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-[6px] text-[13px] ${
        danger
          ? "text-danger hover:bg-red-50"
          : "text-muted hover:bg-surface-soft hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={`transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path
        d="M3.5 1.5L7 5L3.5 8.5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MobileExtras({
  row,
  locale,
}: {
  row: SupplierRow;
  locale: string;
}) {
  const { t } = useI18n();
  const s = row.supplier;
  return (
    <dl className="grid gap-2 border-t border-line px-3 py-3 text-[12px] sm:hidden">
      <div className="flex justify-between gap-2">
        <dt className="text-muted-soft">{t("suppliers.col.products")}</dt>
        <dd>{row.productCount}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-muted-soft">{t("suppliers.col.avgLanded")}</dt>
        <dd>
          {row.avgLandedCost != null ? formatEuro(row.avgLandedCost) : t("common.emDash")}
        </dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-muted-soft">{t("suppliers.col.lastOrder")}</dt>
        <dd>{formatDate(row.lastOrderAt, locale)}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-muted-soft">{t("suppliers.col.incoterm")}</dt>
        <dd>{s.incoterm || t("common.emDash")}</dd>
      </div>
    </dl>
  );
}

function ExpandedComponents({
  components,
  data,
  onAddProduct,
  onEditProduct,
  addProductHref,
  locale,
}: {
  components: Component[];
  data: AppData;
  onAddProduct: () => void;
  onEditProduct: (component: Component) => void;
  addProductHref?: string;
  locale: string;
}) {
  const { t, pricingUnitLabel } = useI18n();
  return (
    <div className="border-t border-line">
      {components.length === 0 ? (
        <p className="px-3 py-3 text-[13px] text-muted-soft">
          {t("suppliers.noProducts")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-line text-[10px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                <th className="px-3 py-2 font-medium">
                  {t("productModal.componentName")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("components.col.product")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("productModal.componentPrice")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("productModal.componentQty")}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  {t("components.col.batches")}
                </th>
              </tr>
            </thead>
            <tbody>
              {components.flatMap((c) => {
                const links = (data.productComponents ?? []).filter(
                  (pc) => pc.componentId === c.id,
                );
                const rows =
                  links.length > 0
                    ? links
                    : [
                        {
                          id: `none-${c.id}`,
                          productId: "",
                          quantityPerProductUnit: 0,
                        },
                      ];
                return rows.map((pc) => {
                  const product = data.catalogProducts.find(
                    (p) => p.id === pc.productId,
                  );
                  const m = product
                    ? buildProductMetrics(product.id, data)
                    : null;
                  const unit = product
                    ? pricingUnitLabel(product.pricingUnit)
                    : pricingUnitLabel("pcs");
                  return (
                    <tr
                      key={`${c.id}-${pc.id}`}
                      className="border-b border-line/70 last:border-0 hover:bg-white/60"
                    >
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => onEditProduct(c)}
                          className="text-left font-medium text-foreground hover:text-accent"
                        >
                          {c.name || t("common.emDash")}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {product?.name ?? t("common.emDash")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatEuro(c.purchasePricePerUnit, locale)}
                        <span className="ml-1 text-muted-soft">/ {unit}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">
                        {"quantityPerProductUnit" in pc
                          ? pc.quantityPerProductUnit
                          : t("common.emDash")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted">
                        {m?.batchCount ?? 0}
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-3 py-2.5">
        {addProductHref ? (
          <Link
            href={addProductHref}
            className="inline-flex items-center rounded-full border border-line bg-white px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:border-line-strong hover:text-foreground"
          >
            {t("suppliers.addProduct")}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAddProduct}
            className="inline-flex items-center rounded-full border border-line bg-white px-2.5 py-1 text-[12px] font-medium text-muted transition-colors hover:border-line-strong hover:text-foreground"
          >
            {t("suppliers.addProduct")}
          </button>
        )}
      </div>
    </div>
  );
}

function SupplierCard({
  row,
  onEdit,
  onDelete,
  onOpen,
  expanded,
  components,
  data,
  onAddProduct,
  onEditProduct,
  addProductHref,
  countryLabel,
  supplierStatusLabel,
  locale,
}: {
  row: SupplierRow;
  onEdit: () => void;
  onDelete: () => void;
  onOpen: () => void;
  expanded: boolean;
  components: Component[];
  data: AppData;
  onAddProduct: () => void;
  onEditProduct: (component: Component) => void;
  addProductHref?: string;
  countryLabel: (code: string) => string;
  supplierStatusLabel: (status: SupplierStatus) => string;
  locale: string;
}) {
  const { t } = useI18n();
  const s = row.supplier;
  return (
    <div className="rounded-[12px] border border-line bg-white p-4 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 text-left">
          <p className="truncate text-[14px] font-semibold text-foreground hover:text-accent">
            {s.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
            <CountryFlag code={s.country} />
            {countryLabel(s.country)} · {s.incoterm}
          </p>
        </button>
        <StatusBadge
          status={s.status}
          label={supplierStatusLabel(s.status)}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <div>
          <dt className="text-muted-soft">{t("suppliers.col.products")}</dt>
          <dd className="font-medium tabular-nums">{row.productCount}</dd>
        </div>
        <div>
          <dt className="text-muted-soft">{t("suppliers.col.avgLanded")}</dt>
          <dd className="font-medium tabular-nums">
            {row.avgLandedCost != null ? formatEuro(row.avgLandedCost) : t("common.emDash")}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-soft">{t("suppliers.col.lastOrder")}</dt>
          <dd>{formatDate(row.lastOrderAt, locale)}</dd>
        </div>
      </dl>
      <div className="mt-3 flex gap-1 border-t border-line pt-3">
        <Button variant="ghost" className="h-7 px-2" onClick={onEdit}>
          {t("common.edit")}
        </Button>
        <Button variant="danger" className="h-7 px-2" onClick={onDelete}>
          ×
        </Button>
      </div>
      {expanded ? (
        <div className="mt-3 border-t border-line pt-3">
          <ExpandedComponents
            components={components}
            data={data}
            addProductHref={addProductHref}
            onAddProduct={onAddProduct}
            onEditProduct={onEditProduct}
            locale={locale}
          />
        </div>
      ) : null}
    </div>
  );
}
