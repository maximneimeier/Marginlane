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
  CompanySettings,
  Component,
  Dealer,
  LogisticsBuildingBlock,
  LogisticsTemplate,
  OverheadActual,
  OverheadItem,
  PersonnelRole,
  PersonnelTeam,
  Product,
  ProductComponent,
  SalesPlanCell,
  SalesPlanRowMeta,
  SalesPlanScenario,
  SalesPlanSettings,
  Supplier,
} from "@/lib/types";
import { EMPTY_COMPANY_SETTINGS, EMPTY_DATA } from "@/lib/types";
import { normalizeCompanySettings } from "@/lib/companySettings";
import { migrateAppData } from "@/lib/migrateAppData";
import {
  freezeKey,
  mergeSalesPlan,
  mergeSalesPlanRowMeta,
  scrubDealerFromRowMeta,
  scrubDealerFromSalesPlan,
} from "@/lib/salesPlan";
import { detachDealerFromSale } from "@/lib/storage";

type StoreContextValue = {
  ready: boolean;
  data: AppData;
  upsertSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;
  /** @deprecated Legacy — nutze upsertComponent */
  upsertProduct: (product: Product) => void;
  /** @deprecated Legacy — nutze deleteComponent */
  deleteProduct: (id: string) => void;
  upsertCatalogProduct: (product: CatalogProduct) => void;
  deleteCatalogProduct: (id: string) => void;
  upsertComponent: (component: Component) => void;
  /**
   * Löscht nur, wenn keine ProductComponent-Links existieren.
   * @returns false wenn blockiert
   */
  deleteComponent: (id: string) => boolean;
  upsertProductComponent: (link: ProductComponent) => void;
  deleteProductComponent: (id: string) => void;
  /** Produktnamen, in denen die Komponente noch verbaut ist */
  linkedProductNamesForComponent: (componentId: string) => string[];
  upsertDealer: (dealer: Dealer) => void;
  deleteDealer: (id: string) => void;
  upsertLogisticsBuildingBlock: (block: LogisticsBuildingBlock) => void;
  /**
   * Löscht nur, wenn keine Vorlage den Baustein nutzt.
   * @returns false wenn blockiert
   */
  deleteLogisticsBuildingBlock: (id: string) => boolean;
  upsertLogisticsTemplate: (template: LogisticsTemplate) => void;
  deleteLogisticsTemplate: (id: string) => void;
  /** Vorlagennamen, die den Baustein noch referenzieren */
  linkedTemplateNamesForBuildingBlock: (blockId: string) => string[];
  upsertBatch: (batch: Batch) => void;
  deleteBatch: (id: string) => void;
  upsertOverheadItem: (item: OverheadItem) => void;
  deleteOverheadItem: (id: string) => void;
  upsertOverheadActual: (actual: OverheadActual) => void;
  deleteOverheadActual: (id: string) => void;
  upsertPersonnelRole: (role: PersonnelRole) => void;
  deletePersonnelRole: (id: string) => void;
  upsertPersonnelTeam: (team: PersonnelTeam) => void;
  deletePersonnelTeam: (id: string) => void;
  /** Zellen mergen; quantity 0 entfernt den Eintrag */
  applySalesPlanUpdates: (updates: SalesPlanCell[]) => void;
  upsertSalesPlanRowMeta: (meta: SalesPlanRowMeta) => void;
  patchSalesPlanSettings: (patch: Partial<SalesPlanSettings>) => void;
  patchCompanySettings: (patch: Partial<CompanySettings>) => void;
  setSalesPlanFrozen: (
    year: number,
    scenario: SalesPlanScenario,
    frozen: boolean,
  ) => void;
  importSalesPlan: (cells: SalesPlanCell[], rowMeta: SalesPlanRowMeta[]) => void;
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

function scrubPersonnelManualShares(
  roles: PersonnelRole[],
  productId: string,
): PersonnelRole[] {
  return roles.map((role) => {
    if (!role.manuelleAufteilung) return role;
    const next = role.manuelleAufteilung.filter(
      (row) => row.productId !== productId,
    );
    return { ...role, manuelleAufteilung: next.length > 0 ? next : null };
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
    let detail = "";
    try {
      const body = (await res.json()) as {
        error?: string;
        issues?: { path: string; message: string }[];
      };
      if (body.issues?.length) {
        detail = `: ${body.issues
          .slice(0, 3)
          .map((i) => i.message)
          .join("; ")}`;
      } else if (body.error) {
        detail = `: ${body.error}`;
      }
    } catch {
      /* ignore parse errors */
    }
    throw new Error(`Failed to save workspace (${res.status})${detail}`);
  }
  return migrateAppData(await res.json());
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
        const payload = migrateAppData(await res.json());
        if (!cancelled) setData(payload);
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
      commit((prev) => ({
        ...prev,
        suppliers: prev.suppliers.filter((s) => s.id !== id),
        components: prev.components.map((c) =>
          c.supplierId === id ? { ...c, supplierId: "" } : c,
        ),
        batches: prev.batches.map((b) =>
          b.supplierId === id ? { ...b, supplierId: "" } : b,
        ),
      }));
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
        personnelRoles: scrubPersonnelManualShares(
          prev.personnelRoles ?? [],
          id,
        ),
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
        productComponents: (prev.productComponents ?? []).filter(
          (pc) => pc.productId !== id,
        ),
        batches: prev.batches.filter((b) => b.productId !== id),
        salesPlan: (prev.salesPlan ?? []).filter((c) => c.productId !== id),
        salesPlanRowMeta: (prev.salesPlanRowMeta ?? []).filter(
          (m) => m.productId !== id,
        ),
        overheadItems: scrubManualShares(prev.overheadItems, id),
        personnelRoles: scrubPersonnelManualShares(
          prev.personnelRoles ?? [],
          id,
        ),
      }));
    },
    [commit],
  );

  const upsertComponent = useCallback(
    (component: Component) => {
      commit((prev) => ({
        ...prev,
        components: prev.components.some((c) => c.id === component.id)
          ? prev.components.map((c) =>
              c.id === component.id ? component : c,
            )
          : [...prev.components, component],
      }));
    },
    [commit],
  );

  const linkedProductNamesForComponent = useCallback(
    (componentId: string) => {
      const links = (data.productComponents ?? []).filter(
        (pc) => pc.componentId === componentId,
      );
      return links
        .map(
          (pc) =>
            data.catalogProducts.find((p) => p.id === pc.productId)?.name ??
            pc.productId,
        )
        .filter(Boolean);
    },
    [data.productComponents, data.catalogProducts],
  );

  const deleteComponent = useCallback(
    (id: string) => {
      const linked = (data.productComponents ?? []).some(
        (pc) => pc.componentId === id,
      );
      if (linked) return false;
      commit((prev) => ({
        ...prev,
        components: prev.components.filter((c) => c.id !== id),
      }));
      return true;
    },
    [commit, data.productComponents],
  );

  const upsertProductComponent = useCallback(
    (link: ProductComponent) => {
      commit((prev) => {
        const list = prev.productComponents ?? [];
        return {
          ...prev,
          productComponents: list.some((pc) => pc.id === link.id)
            ? list.map((pc) => (pc.id === link.id ? link : pc))
            : [...list, link],
        };
      });
    },
    [commit],
  );

  const deleteProductComponent = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        productComponents: (prev.productComponents ?? []).filter(
          (pc) => pc.id !== id,
        ),
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
          salesPlan: scrubDealerFromSalesPlan(prev.salesPlan ?? [], id),
          salesPlanRowMeta: scrubDealerFromRowMeta(
            prev.salesPlanRowMeta ?? [],
            id,
          ),
          batches: prev.batches.map((b) => ({
            ...b,
            sales: b.sales.map((s) =>
              s.dealerId === id ? detachDealerFromSale(s, dealer) : s,
            ),
          })),
          logisticsTemplates: (prev.logisticsTemplates ?? []).map((tpl) =>
            tpl.supplierId === id ? { ...tpl, supplierId: "" } : tpl,
          ),
        };
      });
    },
    [commit],
  );

  const linkedTemplateNamesForBuildingBlock = useCallback(
    (blockId: string) => {
      return (data.logisticsTemplates ?? [])
        .filter((tpl) =>
          tpl.items.some((item) => item.buildingBlockId === blockId),
        )
        .map((tpl) => tpl.name || tpl.id);
    },
    [data.logisticsTemplates],
  );

  const upsertLogisticsBuildingBlock = useCallback(
    (block: LogisticsBuildingBlock) => {
      commit((prev) => {
        const list = prev.logisticsBuildingBlocks ?? [];
        return {
          ...prev,
          logisticsBuildingBlocks: list.some((b) => b.id === block.id)
            ? list.map((b) => (b.id === block.id ? block : b))
            : [...list, block],
        };
      });
    },
    [commit],
  );

  const deleteLogisticsBuildingBlock = useCallback(
    (id: string) => {
      const linked = (data.logisticsTemplates ?? []).some((tpl) =>
        tpl.items.some((item) => item.buildingBlockId === id),
      );
      if (linked) return false;
      commit((prev) => ({
        ...prev,
        logisticsBuildingBlocks: (prev.logisticsBuildingBlocks ?? []).filter(
          (b) => b.id !== id,
        ),
      }));
      return true;
    },
    [commit, data.logisticsTemplates],
  );

  const upsertLogisticsTemplate = useCallback(
    (template: LogisticsTemplate) => {
      commit((prev) => {
        const list = prev.logisticsTemplates ?? [];
        return {
          ...prev,
          logisticsTemplates: list.some((t) => t.id === template.id)
            ? list.map((t) => (t.id === template.id ? template : t))
            : [...list, template],
        };
      });
    },
    [commit],
  );

  const deleteLogisticsTemplate = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        logisticsTemplates: (prev.logisticsTemplates ?? []).filter(
          (t) => t.id !== id,
        ),
      }));
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
      const now = new Date().toISOString();
      const stamped: OverheadItem = {
        ...item,
        updatedAt: now,
        updatedBy: item.updatedBy ?? null,
        createdAt: item.createdAt || now,
      };
      commit((prev) => ({
        ...prev,
        overheadItems: prev.overheadItems.some((o) => o.id === stamped.id)
          ? prev.overheadItems.map((o) =>
              o.id === stamped.id ? stamped : o,
            )
          : [...prev.overheadItems, stamped],
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

  const upsertOverheadActual = useCallback(
    (actual: OverheadActual) => {
      const now = new Date().toISOString();
      const stamped: OverheadActual = {
        ...actual,
        updatedAt: now,
        updatedBy: actual.updatedBy ?? null,
        createdAt: actual.createdAt || now,
      };
      commit((prev) => {
        const list = prev.overheadActuals ?? [];
        const next = list.some((a) => a.id === stamped.id)
          ? list.map((a) => (a.id === stamped.id ? stamped : a))
          : [...list, stamped];
        return {
          ...prev,
          overheadActuals: next.sort((a, b) =>
            a.month === b.month
              ? a.name.localeCompare(b.name)
              : a.month.localeCompare(b.month),
          ),
        };
      });
    },
    [commit],
  );

  const deleteOverheadActual = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        overheadActuals: (prev.overheadActuals ?? []).filter(
          (a) => a.id !== id,
        ),
      }));
    },
    [commit],
  );

  const upsertPersonnelRole = useCallback(
    (role: PersonnelRole) => {
      const now = new Date().toISOString();
      const stamped: PersonnelRole = {
        ...role,
        updatedAt: now,
        updatedBy: role.updatedBy ?? null,
        createdAt: role.createdAt || now,
      };
      commit((prev) => {
        const list = prev.personnelRoles ?? [];
        return {
          ...prev,
          personnelRoles: list.some((r) => r.id === stamped.id)
            ? list.map((r) => (r.id === stamped.id ? stamped : r))
            : [...list, stamped],
        };
      });
    },
    [commit],
  );

  const deletePersonnelRole = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        personnelRoles: (prev.personnelRoles ?? []).filter((r) => r.id !== id),
      }));
    },
    [commit],
  );

  const upsertPersonnelTeam = useCallback(
    (team: PersonnelTeam) => {
      const now = new Date().toISOString();
      const stamped: PersonnelTeam = {
        ...team,
        updatedAt: now,
        createdAt: team.createdAt || now,
      };
      commit((prev) => {
        const list = prev.personnelTeams ?? [];
        return {
          ...prev,
          personnelTeams: list.some((t) => t.id === stamped.id)
            ? list.map((t) => (t.id === stamped.id ? stamped : t))
            : [...list, stamped],
        };
      });
    },
    [commit],
  );

  const deletePersonnelTeam = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        personnelTeams: (prev.personnelTeams ?? []).filter((t) => t.id !== id),
        personnelRoles: (prev.personnelRoles ?? []).map((r) =>
          r.teamId === id ? { ...r, teamId: "" } : r,
        ),
      }));
    },
    [commit],
  );

  const applySalesPlanUpdates = useCallback(
    (updates: SalesPlanCell[]) => {
      commit((prev) => ({
        ...prev,
        salesPlan: mergeSalesPlan(prev.salesPlan ?? [], updates),
      }));
    },
    [commit],
  );

  const upsertSalesPlanRowMeta = useCallback(
    (meta: SalesPlanRowMeta) => {
      commit((prev) => ({
        ...prev,
        salesPlanRowMeta: mergeSalesPlanRowMeta(prev.salesPlanRowMeta ?? [], [
          meta,
        ]),
      }));
    },
    [commit],
  );

  const patchSalesPlanSettings = useCallback(
    (patch: Partial<SalesPlanSettings>) => {
      commit((prev) => ({
        ...prev,
        salesPlanSettings: {
          ...(prev.salesPlanSettings ?? {
            activeScenario: "base" as const,
            frozen: [],
          }),
          ...patch,
        },
      }));
    },
    [commit],
  );

  const patchCompanySettings = useCallback(
    (patch: Partial<CompanySettings>) => {
      commit((prev) => ({
        ...prev,
        companySettings: normalizeCompanySettings({
          ...(prev.companySettings ?? EMPTY_COMPANY_SETTINGS),
          ...patch,
        }),
      }));
    },
    [commit],
  );

  const setSalesPlanFrozen = useCallback(
    (year: number, scenario: SalesPlanScenario, frozen: boolean) => {
      commit((prev) => {
        const settings = prev.salesPlanSettings ?? {
          activeScenario: "base" as const,
          frozen: [],
        };
        const key = freezeKey(year, scenario);
        const nextFrozen = frozen
          ? settings.frozen.includes(key)
            ? settings.frozen
            : [...settings.frozen, key]
          : settings.frozen.filter((k) => k !== key);
        return {
          ...prev,
          salesPlanSettings: { ...settings, frozen: nextFrozen },
        };
      });
    },
    [commit],
  );

  const importSalesPlan = useCallback(
    (cells: SalesPlanCell[], rowMeta: SalesPlanRowMeta[]) => {
      commit((prev) => ({
        ...prev,
        salesPlan: mergeSalesPlan(prev.salesPlan ?? [], cells),
        salesPlanRowMeta: mergeSalesPlanRowMeta(
          prev.salesPlanRowMeta ?? [],
          rowMeta,
        ),
      }));
    },
    [commit],
  );

  const clearData = useCallback(async () => {
    clearLegacyLocalStorage();
    const res = await fetch("/api/workspace", { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to clear workspace (${res.status})`);
    setData(migrateAppData(await res.json()));
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
      upsertComponent,
      deleteComponent,
      upsertProductComponent,
      deleteProductComponent,
      linkedProductNamesForComponent,
      upsertDealer,
      deleteDealer,
      upsertLogisticsBuildingBlock,
      deleteLogisticsBuildingBlock,
      upsertLogisticsTemplate,
      deleteLogisticsTemplate,
      linkedTemplateNamesForBuildingBlock,
      upsertBatch,
      deleteBatch,
      upsertOverheadItem,
      deleteOverheadItem,
      upsertOverheadActual,
      deleteOverheadActual,
      upsertPersonnelRole,
      deletePersonnelRole,
      upsertPersonnelTeam,
      deletePersonnelTeam,
      applySalesPlanUpdates,
      upsertSalesPlanRowMeta,
      patchSalesPlanSettings,
      patchCompanySettings,
      setSalesPlanFrozen,
      importSalesPlan,
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
      upsertComponent,
      deleteComponent,
      upsertProductComponent,
      deleteProductComponent,
      linkedProductNamesForComponent,
      upsertDealer,
      deleteDealer,
      upsertLogisticsBuildingBlock,
      deleteLogisticsBuildingBlock,
      upsertLogisticsTemplate,
      deleteLogisticsTemplate,
      linkedTemplateNamesForBuildingBlock,
      upsertBatch,
      deleteBatch,
      upsertOverheadItem,
      deleteOverheadItem,
      upsertOverheadActual,
      deleteOverheadActual,
      upsertPersonnelRole,
      deletePersonnelRole,
      upsertPersonnelTeam,
      deletePersonnelTeam,
      applySalesPlanUpdates,
      upsertSalesPlanRowMeta,
      patchSalesPlanSettings,
      patchCompanySettings,
      setSalesPlanFrozen,
      importSalesPlan,
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
