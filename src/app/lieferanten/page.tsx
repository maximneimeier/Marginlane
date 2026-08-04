"use client";

import { useState } from "react";
import { useStore } from "@/context/StoreContext";
import type { Product, Supplier } from "@/lib/types";
import {
  SupplierFormModal,
  emptySupplier,
} from "@/components/SupplierFormModal";
import {
  ProductFormModal,
  emptyProduct,
} from "@/components/ProductFormModal";
import { SuppliersOverview } from "@/components/SuppliersOverview";

export default function LieferantenPage() {
  const {
    ready,
    data,
    upsertSupplier,
    deleteSupplier,
    upsertProduct,
    resetDemo,
  } = useStore();
  const [supplierModal, setSupplierModal] = useState<{
    open: boolean;
    draft: Supplier | null;
    isEdit: boolean;
  }>({ open: false, draft: null, isEdit: false });
  const [productDraft, setProductDraft] = useState<Product | null>(null);

  if (!ready) return <p className="text-[13px] text-muted">Laden…</p>;

  function openCreateSupplier() {
    setSupplierModal({ open: true, draft: emptySupplier(), isEdit: false });
  }

  function openEditSupplier(supplier: Supplier) {
    setSupplierModal({ open: true, draft: supplier, isEdit: true });
  }

  const isEditProduct = Boolean(
    productDraft && data.products.some((p) => p.id === productDraft.id),
  );

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
        onAddProduct={(supplierId) => {
          setProductDraft(emptyProduct(supplierId));
        }}
      />

      <ProductFormModal
        open={Boolean(productDraft)}
        initial={productDraft}
        suppliers={data.suppliers}
        isEdit={isEditProduct}
        onClose={() => setProductDraft(null)}
        onSave={(product) => {
          upsertProduct(product);
        }}
      />

      <SuppliersOverview
        data={data}
        onCreate={openCreateSupplier}
        onEdit={openEditSupplier}
        onDelete={(supplier) => {
          deleteSupplier(supplier.id);
        }}
        onAddProduct={(supplierId) => {
          setProductDraft(emptyProduct(supplierId));
        }}
        onEditProduct={(product) => {
          setProductDraft(product);
        }}
        onResetDemo={resetDemo}
        productsOf={(supplierId) =>
          data.products.filter((p) => p.supplierId === supplierId)
        }
      />
    </div>
  );
}
