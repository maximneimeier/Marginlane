"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/hooks/useI18n";

type ProductOption = { id: string; name: string };

/**
 * Multi-select dropdown for overview product filter.
 * `value === null` → all products; `[]` → none; otherwise selected IDs.
 */
export function ProductFilterDropdown({
  products,
  value,
  onChange,
}: {
  products: ProductOption[];
  value: string[] | null;
  onChange: (next: string[] | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const allSelected = value === null;
  const noneSelected = Array.isArray(value) && value.length === 0;

  const summary = (() => {
    if (products.length === 0) return t("overviewPage.productsEmpty");
    if (allSelected) return t("overviewPage.productsAll");
    if (noneSelected) return t("overviewPage.productsClear");
    if (value.length === 1) {
      return products.find((p) => p.id === value[0])?.name ?? value[0];
    }
    return t("overviewPage.productsCount", { count: value.length });
  })();

  function isChecked(id: string) {
    return allSelected || (value?.includes(id) ?? false);
  }

  function toggle(id: string) {
    if (value === null) {
      onChange(products.map((p) => p.id).filter((x) => x !== id));
      return;
    }
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id));
      return;
    }
    const next = [...value, id];
    onChange(next.length >= products.length ? null : next);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={products.length === 0}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-[8px] border border-line bg-white px-3 py-[7px] text-left text-[13px] text-foreground outline-none transition-[border-color,box-shadow] hover:border-line-strong focus:border-accent focus:shadow-[0_0_0_3px_rgba(38,109,240,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0 truncate">{summary}</span>
        <Chevron open={open} />
      </button>

      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable
          className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-[10px] border border-line bg-white shadow-[var(--shadow-md,0_8px_24px_rgba(0,0,0,0.08))]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <button
              type="button"
              className="text-[12px] font-medium text-accent hover:underline"
              onClick={() => onChange(null)}
            >
              {t("overviewPage.productsAll")}
            </button>
            <button
              type="button"
              className="text-[12px] text-muted hover:text-foreground hover:underline"
              onClick={() => onChange([])}
            >
              {t("overviewPage.productsClear")}
            </button>
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {products.map((product) => {
              const checked = isChecked(product.id);
              return (
                <li key={product.id} role="option" aria-selected={checked}>
                  <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] hover:bg-surface-faint">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(product.id)}
                      className="h-3.5 w-3.5 shrink-0 rounded border-line accent-[var(--accent)]"
                    />
                    <span className="min-w-0 truncate">{product.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`shrink-0 text-muted-soft transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        d="M3 4.5 6 7.5 9 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
