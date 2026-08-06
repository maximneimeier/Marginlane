"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AppData,
  Batch,
  CatalogProduct,
  Dealer,
  OverheadItem,
  Product,
  Supplier,
} from "@/lib/types";
import { EMPTY_DATA } from "@/lib/types";
import { detachDealerFromSales } from "@/lib/storage";

type StoreContextValue = {
  ready: boolean;
  data: AppData;
  upsertSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;
  upsertProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  upsertCatalogProduct: (product: CatalogProduct) => void;
  deleteCatalogProduct: (id: string) => void;
  upsertDealer: (dealer: Dealer) => void;
  deleteDealer: (id: string) => void;
  upsertBatch: (batch: Batch) => void;
  deleteBatch: (id: string) => void;
  upsertOverheadItem: (item: OverheadItem) => void;
  deleteOverheadItem: (id: string) => void;
  /** Clears all workspace data in PostgreSQL (no mock reseed). */
  clearData: () => Promise<void>;
};

const StoreContext = createContext<StoreContextValue | null>(null);

const LEGACY_STORAGE_KEYS = [
  "landed-cost-v2",
  "landed-cost-v3",
  "landed-cost-v4",
  "landed-cost-v5",
  "landed-cost-v6",
  "landed-cost-v7",
  "landed-cost-v8",
];

function scrubManualShares(
  items: OverheadItem[],
  productId: string,
): OverheadItem[] {
  return items.map((item) => {
    if (!item.manuelleAufteilung) return item;
    const next = item.manuelleAufteilung.filter(
      (row) => row.productId !== productId,
    );
    return { ...item, manuelleAufteilung: next.length > 0 ? next : null };
  });
}

function clearLegacyLocalStorage() {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

async function persistWorkspace(data: AppData) {
  const res = await fetch("/api/workspace", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`Failed to save workspace (${res.status})`);
  }
  return (await res.json()) as AppData;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const saveChain = useRef(Promise.resolve());

  const queueSave = useCallback((next: AppData) => {
    saveChain.current = saveChain.current
      .then(async () => {
        await persistWorkspace(next);
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    clearLegacyLocalStorage();

    (async () => {
      try {
        const res = await fetch("/api/workspace");
        if (!res.ok) throw new Error(`Failed to load workspace (${res.status})`);
        const payload = (await res.json()) as AppData;
        if (!cancelled) {
          setData({
            suppliers: payload.suppliers ?? [],
            products: payload.products ?? [],
            catalogProducts: payload.catalogProducts ?? [],
            dealers: payload.dealers ?? [],
            batches: payload.batches ?? [],
            overheadItems: payload.overheadItems ?? [],
          });
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setData({ ...EMPTY_DATA });
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback(
    (updater: (prev: AppData) => AppData) => {
      setData((prev) => {
        const next = updater(prev);
        queueSave(next);
        return next;
      });
    },
    [queueSave],
  );

  const upsertSupplier = useCallback(
    (supplier: Supplier) => {
      commit((prev) => ({
        ...prev,
        suppliers: prev.suppliers.some((s) => s.id === supplier.id)
          ? prev.suppliers.map((s) => (s.id === supplier.id ? supplier : s))
          : [...prev.suppliers, supplier],
      }));
    },
    [commit],
  );

  const deleteSupplier = useCallback(
    (id: string) => {
      commit((prev) => {
        const removedProductIds = new Set(
          prev.products.filter((p) => p.supplierId === id).map((p) => p.id),
        );
        let overheadItems = prev.overheadItems;
        for (const productId of removedProductIds) {
          overheadItems = scrubManualShares(overheadItems, productId);
        }
        return {
          ...prev,
          suppliers: prev.suppliers.filter((s) => s.id !== id),
          products: prev.products.filter((p) => p.supplierId !== id),
          batches: prev.batches.filter((b) => b.supplierId !== id),
          overheadItems,
        };
      });
    },
    [commit],
  );

  const upsertProduct = useCallback(
    (product: Product) => {
      commit((prev) => ({
        ...prev,
        products: prev.products.some((p) => p.id === product.id)
          ? prev.products.map((p) => (p.id === product.id ? product : p))
          : [...prev.products, product],
      }));
    },
    [commit],
  );

  const deleteProduct = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== id),
        batches: prev.batches.filter((b) => b.productId !== id),
        overheadItems: scrubManualShares(prev.overheadItems, id),
      }));
    },
    [commit],
  );

  const upsertCatalogProduct = useCallback(
    (product: CatalogProduct) => {
      commit((prev) => ({
        ...prev,
        catalogProducts: prev.catalogProducts.some((p) => p.id === product.id)
          ? prev.catalogProducts.map((p) =>
              p.id === product.id ? product : p,
            )
          : [...prev.catalogProducts, product],
      }));
    },
    [commit],
  );

  const deleteCatalogProduct = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        catalogProducts: prev.catalogProducts.filter((p) => p.id !== id),
      }));
    },
    [commit],
  );

  const upsertDealer = useCallback(
    (dealer: Dealer) => {
      commit((prev) => ({
        ...prev,
        dealers: prev.dealers.some((d) => d.id === dealer.id)
          ? prev.dealers.map((d) => (d.id === dealer.id ? dealer : d))
          : [...prev.dealers, dealer],
      }));
    },
    [commit],
  );

  const deleteDealer = useCallback(
    (id: string) => {
      commit((prev) => {
        const dealer = prev.dealers.find((d) => d.id === id);
        return {
          ...prev,
          dealers: prev.dealers.filter((d) => d.id !== id),
          batches: prev.batches.map((b) =>
            b.sales.dealerId === id
              ? {
                  ...b,
                  sales: detachDealerFromSales(b.sales, dealer),
                }
              : b,
          ),
        };
      });
    },
    [commit],
  );

  const upsertBatch = useCallback(
    (batch: Batch) => {
      commit((prev) => ({
        ...prev,
        batches: prev.batches.some((b) => b.id === batch.id)
          ? prev.batches.map((b) => (b.id === batch.id ? batch : b))
          : [...prev.batches, batch],
      }));
    },
    [commit],
  );

  const deleteBatch = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        batches: prev.batches.filter((b) => b.id !== id),
      }));
    },
    [commit],
  );

  const upsertOverheadItem = useCallback(
    (item: OverheadItem) => {
      commit((prev) => ({
        ...prev,
        overheadItems: prev.overheadItems.some((o) => o.id === item.id)
          ? prev.overheadItems.map((o) => (o.id === item.id ? item : o))
          : [...prev.overheadItems, item],
      }));
    },
    [commit],
  );

  const deleteOverheadItem = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        overheadItems: prev.overheadItems.filter((o) => o.id !== id),
      }));
    },
    [commit],
  );

  const clearData = useCallback(async () => {
    clearLegacyLocalStorage();
    const res = await fetch("/api/workspace", { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to clear workspace (${res.status})`);
    const payload = (await res.json()) as AppData;
    setData({
      suppliers: payload.suppliers ?? [],
      products: payload.products ?? [],
      catalogProducts: payload.catalogProducts ?? [],
      dealers: payload.dealers ?? [],
      batches: payload.batches ?? [],
      overheadItems: payload.overheadItems ?? [],
    });
  }, []);

  const value = useMemo(
    () => ({
      ready,
      data,
      upsertSupplier,
      deleteSupplier,
      upsertProduct,
      deleteProduct,
      upsertCatalogProduct,
      deleteCatalogProduct,
      upsertDealer,
      deleteDealer,
      upsertBatch,
      deleteBatch,
      upsertOverheadItem,
      deleteOverheadItem,
      clearData,
    }),
    [
      ready,
      data,
      upsertSupplier,
      deleteSupplier,
      upsertProduct,
      deleteProduct,
      upsertCatalogProduct,
      deleteCatalogProduct,
      upsertDealer,
      deleteDealer,
      upsertBatch,
      deleteBatch,
      upsertOverheadItem,
      deleteOverheadItem,
      clearData,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
