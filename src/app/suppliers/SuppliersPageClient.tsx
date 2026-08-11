"use client";

import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import type {
  CatalogProduct,
  Component,
  ProductComponent,
  Supplier,
} from "@/lib/types";
import {
  SupplierFormModal,
  emptySupplier,
} from "@/components/SupplierFormModal";
import { CatalogProductFormModal } from "@/components/CatalogProductFormModal";
import { SuppliersOverview } from "@/components/SuppliersOverview";
import { useI18n } from "@/hooks/useI18n";

export default function LieferantenPage() {
  const {
    ready,
    data,
    upsertSupplier,
    deleteSupplier,
    upsertCatalogProduct,
    upsertComponent,
    upsertProductComponent,
    deleteProductComponent,
    clearData,
  } = useStore();
  const { t } = useI18n();
  const [supplierModal, setSupplierModal] = useState<{
    open: boolean;
    draft: Supplier | null;
    isEdit: boolean;
  }>({ open: false, draft: null, isEdit: false });
  const [productDraft, setProductDraft] = useState<CatalogProduct | null>(
    null,
  );

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

  const isEditProduct = Boolean(
    productDraft &&
      data.catalogProducts.some((p) => p.id === productDraft.id),
  );

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
    setProductDraft(null);
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
          /* BOM-Komponenten werden über Produkte gepflegt */
        }}
      />

      <CatalogProductFormModal
        open={Boolean(productDraft)}
        initial={productDraft}
        isEdit={isEditProduct}
        data={data}
        onClose={() => setProductDraft(null)}
        onSave={saveProduct}
      />

      <SuppliersOverview
        data={data}
        onCreate={openCreateSupplier}
        onEdit={openEditSupplier}
        onDelete={(supplier) => {
          deleteSupplier(supplier.id);
        }}
        onAddProduct={() => {
          /* siehe Link auf /products */
        }}
        onEditProduct={(component) => {
          const link = (data.productComponents ?? []).find(
            (pc) => pc.componentId === component.id,
          );
          const product = data.catalogProducts.find(
            (p) => p.id === link?.productId,
          );
          if (product) setProductDraft(product);
        }}
        onClearData={() => {
          void clearData();
        }}
        componentsOf={(supplierId) =>
          data.components.filter((c) => c.supplierId === supplierId)
        }
        addProductHref="/products"
      />
    </div>
  );
}
