"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppData, Batch, Dealer, Product, Supplier } from "@/lib/types";
import { EMPTY_DATA } from "@/lib/types";
import { loadData, saveData, seedDemoData, detachDealerFromSales } from "@/lib/storage";

type StoreContextValue = {
  ready: boolean;
  data: AppData;
  upsertSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;
  upsertProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  upsertDealer: (dealer: Dealer) => void;
  deleteDealer: (id: string) => void;
  upsertBatch: (batch: Batch) => void;
  deleteBatch: (id: string) => void;
  resetDemo: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);

function commit(updater: (prev: AppData) => AppData) {
  return (prev: AppData) => {
    const next = updater(prev);
    saveData(next);
    return next;
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadData());
    setReady(true);
  }, []);

  const upsertSupplier = useCallback((supplier: Supplier) => {
    setData(
      commit((prev) => ({
        ...prev,
        suppliers: prev.suppliers.some((s) => s.id === supplier.id)
          ? prev.suppliers.map((s) => (s.id === supplier.id ? supplier : s))
          : [...prev.suppliers, supplier],
      })),
    );
  }, []);

  const deleteSupplier = useCallback((id: string) => {
    setData(
      commit((prev) => ({
        ...prev,
        suppliers: prev.suppliers.filter((s) => s.id !== id),
        products: prev.products.filter((p) => p.supplierId !== id),
        batches: prev.batches.filter((b) => b.supplierId !== id),
      })),
    );
  }, []);

  const upsertProduct = useCallback((product: Product) => {
    setData(
      commit((prev) => ({
        ...prev,
        products: prev.products.some((p) => p.id === product.id)
          ? prev.products.map((p) => (p.id === product.id ? product : p))
          : [...prev.products, product],
      })),
    );
  }, []);

  const deleteProduct = useCallback((id: string) => {
    setData(
      commit((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== id),
        batches: prev.batches.filter((b) => b.productId !== id),
      })),
    );
  }, []);

  const upsertDealer = useCallback((dealer: Dealer) => {
    setData(
      commit((prev) => ({
        ...prev,
        dealers: prev.dealers.some((d) => d.id === dealer.id)
          ? prev.dealers.map((d) => (d.id === dealer.id ? dealer : d))
          : [...prev.dealers, dealer],
      })),
    );
  }, []);

  const deleteDealer = useCallback((id: string) => {
    setData(
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
      }),
    );
  }, []);

  const upsertBatch = useCallback((batch: Batch) => {
    setData(
      commit((prev) => ({
        ...prev,
        batches: prev.batches.some((b) => b.id === batch.id)
          ? prev.batches.map((b) => (b.id === batch.id ? batch : b))
          : [...prev.batches, batch],
      })),
    );
  }, []);

  const deleteBatch = useCallback((id: string) => {
    setData(
      commit((prev) => ({
        ...prev,
        batches: prev.batches.filter((b) => b.id !== id),
      })),
    );
  }, []);

  const resetDemo = useCallback(() => {
    localStorage.removeItem("landed-cost-v2");
    localStorage.removeItem("landed-cost-v3");
    localStorage.removeItem("landed-cost-v4");
    localStorage.removeItem("landed-cost-v5");
    localStorage.removeItem("landed-cost-v6");
    localStorage.removeItem("landed-cost-v7");
    const seeded = seedDemoData();
    setData(seeded);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      data,
      upsertSupplier,
      deleteSupplier,
      upsertProduct,
      deleteProduct,
      upsertDealer,
      deleteDealer,
      upsertBatch,
      deleteBatch,
      resetDemo,
    }),
    [
      ready,
      data,
      upsertSupplier,
      deleteSupplier,
      upsertProduct,
      deleteProduct,
      upsertDealer,
      deleteDealer,
      upsertBatch,
      deleteBatch,
      resetDemo,
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
