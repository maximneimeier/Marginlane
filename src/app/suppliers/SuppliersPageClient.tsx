"use client";

import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import type { Component, Supplier } from "@/lib/types";
import {
  SupplierFormModal,
  emptySupplier,
} from "@/components/SupplierFormModal";
import {
  ComponentFormModal,
  type ComponentFormSave,
} from "@/components/ComponentFormModal";
import { SuppliersOverview } from "@/components/SuppliersOverview";
import { useI18n } from "@/hooks/useI18n";

export default function LieferantenPage() {
  const {
    ready,
    data,
    upsertSupplier,
    deleteSupplier,
    upsertComponent,
    upsertProductComponent,
    clearData,
  } = useStore();
  const { t } = useI18n();
  const [supplierModal, setSupplierModal] = useState<{
    open: boolean;
    draft: Supplier | null;
    isEdit: boolean;
  }>({ open: false, draft: null, isEdit: false });
  const [componentModal, setComponentModal] = useState<{
    open: boolean;
    draft: Component | null;
    isEdit: boolean;
  }>({ open: false, draft: null, isEdit: false });

  if (!ready) {
    return <p className="text-[13px] text-muted">{t("common.loading")}</p>;
  }

  function openCreateSupplier() {
    setSupplierModal({ open: true, draft: emptySupplier(), isEdit: false });
  }

  function openEditSupplier(supplier: Supplier) {
    setSupplierModal({
      open: true,
      draft: structuredClone(supplier),
      isEdit: true,
    });
  }

  function openEditComponent(component: Component) {
    setComponentModal({
      open: true,
      draft: structuredClone(component),
      isEdit: true,
    });
  }

  function closeComponentModal() {
    setComponentModal({ open: false, draft: null, isEdit: false });
  }

  function handleSaveComponent(result: ComponentFormSave) {
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
    closeComponentModal();
  }

  return (
    <div>
      <SupplierFormModal
        open={supplierModal.open}
        initial={supplierModal.draft}
        isEdit={supplierModal.isEdit}
        onClose={() =>
          setSupplierModal({ open: false, draft: null, isEdit: false })
        }
        onSave={(supplier) => {
          upsertSupplier(supplier);
        }}
        onAddProduct={() => {
          setSupplierModal({ open: false, draft: null, isEdit: false });
          setComponentModal({ open: true, draft: null, isEdit: false });
        }}
      />

      <ComponentFormModal
        open={componentModal.open}
        initial={componentModal.draft}
        isEdit={componentModal.isEdit}
        data={data}
        onClose={closeComponentModal}
        onSave={handleSaveComponent}
      />

      <SuppliersOverview
        data={data}
        onCreate={openCreateSupplier}
        onEdit={openEditSupplier}
        onDelete={(supplier) => {
          deleteSupplier(supplier.id);
        }}
        onAddProduct={() => {
          setComponentModal({ open: true, draft: null, isEdit: false });
        }}
        onEditProduct={openEditComponent}
        onClearData={() => {
          void clearData();
        }}
        componentsOf={(supplierId) =>
          data.components.filter((c) => c.supplierId === supplierId)
        }
        addProductHref="/components"
      />
    </div>
  );
}
