"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppData, Batch, CostItem } from "@/lib/types";
import { PROCUREMENT_PHASES } from "@/lib/types";
import {
  calculateUnitEconomics,
  resolvePurchasePrice,
} from "@/lib/calc";
import { createId, formatEuro, formatPercent } from "@/lib/format";
import { salesFromDealer } from "@/lib/storage";
import { CostItemEditor } from "@/components/CostItemEditor";
import { SalesCostsReadonly } from "@/components/SalesCostsReadonly";
import {
  Button,
  Field,
  Modal,
  Select,
  TextInput,
} from "@/components/ui";

type Props = {
  open: boolean;
  data: AppData;
  /** Optional vorausgewähltes Produkt */
  initialProductId?: string;
  onClose: () => void;
  onSave: (batch: Batch) => void;
};

export function BatchFormModal({
  open,
  data,
  initialProductId = "",
  onClose,
  onSave,
}: Props) {
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [label, setLabel] = useState("");
  const [quantity, setQuantity] = useState(500);
  const [unitPrice, setUnitPrice] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [sellPrice, setSellPrice] = useState(0);
  const [dealerId, setDealerId] = useState("");
  const [salesItems, setSalesItems] = useState<CostItem[]>([]);
  const [priceManual, setPriceManual] = useState(false);

  const supplier = data.suppliers.find((s) => s.id === supplierId);
  const product = data.products.find((p) => p.id === productId);
  const dealer = data.dealers.find((d) => d.id === dealerId);

  const supplierProducts = useMemo(
    () =>
      data.products
        .filter((p) => p.supplierId === supplierId)
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    [data.products, supplierId],
  );

  const pricing = useMemo(() => {
    if (!product) return null;
    return resolvePurchasePrice(
      product.unitPrice,
      quantity,
      product.discountTiers,
    );
  }, [product, quantity]);

  useEffect(() => {
    if (!open) return;
    const initialProduct =
      initialProductId
        ? data.products.find((p) => p.id === initialProductId)
        : undefined;
    const nextSupplierId = initialProduct?.supplierId ?? "";
    const nextProductId = initialProduct?.id ?? "";

    setSupplierId(nextSupplierId);
    setProductId(nextProductId);
    setLabel(
      `PO-${new Date().getFullYear()}-${String(data.batches.length + 1).padStart(3, "0")}`,
    );
    setQuantity(
      initialProduct && initialProduct.moq > 0 ? initialProduct.moq : 500,
    );
    setUnitPrice(0);
    setPaymentTerms(
      initialProduct
        ? data.suppliers.find((s) => s.id === initialProduct.supplierId)
            ?.paymentTerms ?? ""
        : "",
    );
    setCostItems([]);
    setSellPrice(0);
    setDealerId("");
    setSalesItems([]);
    setPriceManual(false);
  }, [open, initialProductId, data.products, data.suppliers, data.batches.length]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !pricing || priceManual) return;
    setUnitPrice(pricing.unitPrice);
  }, [open, pricing, priceManual]);

  const preview = calculateUnitEconomics({
    quantity,
    unitPurchasePrice: unitPrice,
    procurementItems: costItems,
    sellPrice,
    salesItems,
  });

  function handleSupplierChange(id: string) {
    setSupplierId(id);
    setProductId("");
    setPriceManual(false);
    setUnitPrice(0);
    const s = data.suppliers.find((x) => x.id === id);
    setPaymentTerms(s?.paymentTerms ?? "");
  }

  function handleProductChange(id: string) {
    setProductId(id);
    setPriceManual(false);
    const p = data.products.find((x) => x.id === id);
    if (p && p.moq > 0) setQuantity(p.moq);
  }

  function handleSave() {
    if (!product || !supplier || !label.trim() || quantity <= 0) return;

    const batch: Batch = {
      id: createId("bat"),
      productId: product.id,
      supplierId: supplier.id,
      label: label.trim(),
      quantity,
      unitPurchasePrice: unitPrice,
      paymentTerms,
      costItems,
      sales: {
        sellPrice,
        quantity,
        dealerId,
        channel: dealer?.name ?? "",
        costItems: salesItems,
      },
      createdAt: new Date().toISOString(),
    };
    onSave(batch);
    onClose();
  }

  const canSave = Boolean(
    supplier && product && label.trim() && quantity > 0,
  );

  const nextTier = product
    ? [...product.discountTiers]
        .filter((t) => quantity < t.minQty)
        .sort((a, b) => a.minQty - b.minQty)[0]
    : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Neue Charge"
      description="Lieferant und Produkt wählen — Menge bestimmt den Einkaufspreis inkl. Rabattstaffel."
      wide
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div className="grid gap-3 rounded-[10px] border border-line bg-surface-faint px-3.5 py-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
              Landed Cost / Stk.
            </p>
            <p className="mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight">
              {formatEuro(preview.landedCostPerUnit)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
              Nettomarge / Stk.
            </p>
            <p
              className={`mt-0.5 text-[18px] font-semibold tabular-nums tracking-tight ${
                preview.contributionPerUnit >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {formatEuro(preview.contributionPerUnit)}
            </p>
          </div>
        </div>

        <section>
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-soft">
            Bestellung
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Lieferant" required>
              <Select
                value={supplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
                autoFocus={!initialProductId}
              >
                <option value="">Lieferant wählen…</option>
                {[...data.suppliers]
                  .sort((a, b) => a.name.localeCompare(b.name, "de"))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.incoterm ? ` · ${s.incoterm}` : ""}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Produkt" required>
              <Select
                value={productId}
                onChange={(e) => handleProductChange(e.target.value)}
                disabled={!supplierId}
              >
                <option value="">
                  {supplierId ? "Produkt wählen…" : "Zuerst Lieferant wählen"}
                </option>
                {supplierProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.sku ? ` (${p.sku})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Bezeichnung / PO" required>
              <TextInput
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </Field>
            <Field
              label="Menge"
              required
              hint={
                product?.moq
                  ? `MOQ: ${product.moq.toLocaleString("de-DE")} Stk.`
                  : undefined
              }
            >
              <TextInput
                type="number"
                min="1"
                value={quantity || ""}
                onChange={(e) => {
                  setQuantity(Number(e.target.value) || 0);
                  setPriceManual(false);
                }}
              />
            </Field>
            <Field label="Zahlungskonditionen">
              <TextInput
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-[12px] border border-line bg-white p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">
                Einkaufspreis
              </h3>
              <p className="mt-0.5 text-[12px] text-muted">
                Wird aus Listenpreis und Rabattstaffel zur Menge berechnet.
              </p>
            </div>
            {priceManual ? (
              <button
                type="button"
                className="text-[12px] font-medium text-accent hover:underline"
                onClick={() => setPriceManual(false)}
              >
                Automatik wiederherstellen
              </button>
            ) : (
              <span className="rounded-[6px] bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                Automatisch
              </span>
            )}
          </div>

          {!product ? (
            <p className="text-[13px] text-muted">
              Produkt wählen, um den Preis zu berechnen.
            </p>
          ) : (
            <>
              <dl className="mb-4 grid gap-2 text-[13px] sm:grid-cols-2">
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted">Listenpreis</dt>
                  <dd className="font-medium tabular-nums sm:mt-0.5">
                    {formatEuro(pricing?.listPrice ?? product.unitPrice)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted">Rabatt</dt>
                  <dd className="font-medium tabular-nums sm:mt-0.5">
                    {pricing && pricing.discountPercent > 0 ? (
                      <>
                        −{formatPercent(pricing.discountPercent)}
                        {pricing.tierMinQty != null ? (
                          <span className="ml-1 text-[12px] font-normal text-muted-soft">
                            (ab {pricing.tierMinQty.toLocaleString("de-DE")} Stk.)
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-soft">kein Staffelrabatt</span>
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted">EK / Stück</dt>
                  <dd className="text-[15px] font-semibold tabular-nums text-foreground sm:mt-0.5">
                    {formatEuro(unitPrice)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted">Warenwert</dt>
                  <dd className="font-medium tabular-nums sm:mt-0.5">
                    {formatEuro(unitPrice * Math.max(quantity, 0))}
                    {pricing && pricing.savingsPerUnit > 0 ? (
                      <span className="ml-1 text-[12px] font-normal text-success">
                        (−
                        {formatEuro(
                          pricing.savingsPerUnit * Math.max(quantity, 0),
                        )}{" "}
                        vs. Liste)
                      </span>
                    ) : null}
                  </dd>
                </div>
              </dl>

              {product.discountTiers.length > 0 ? (
                <div className="mb-4 rounded-[8px] border border-line bg-surface-faint px-3 py-2.5">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-soft">
                    Rabattstaffeln
                  </p>
                  <ul className="space-y-1">
                    {[...product.discountTiers]
                      .sort((a, b) => a.minQty - b.minQty)
                      .map((tier) => {
                        const active =
                          pricing?.tierMinQty === tier.minQty &&
                          pricing.discountPercent === tier.discountPercent;
                        return (
                          <li
                            key={`${tier.minQty}-${tier.discountPercent}`}
                            className={`flex justify-between gap-3 text-[12px] ${
                              active
                                ? "font-medium text-foreground"
                                : "text-muted"
                            }`}
                          >
                            <span>
                              ab {tier.minQty.toLocaleString("de-DE")} Stk.
                              {active ? " · aktiv" : ""}
                            </span>
                            <span className="tabular-nums">
                              −{formatPercent(tier.discountPercent)} →{" "}
                              {formatEuro(
                                product.unitPrice *
                                  (1 - tier.discountPercent / 100),
                              )}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                  {nextTier ? (
                    <p className="mt-2 text-[12px] text-muted">
                      Nächste Stufe ab{" "}
                      {nextTier.minQty.toLocaleString("de-DE")} Stk. (
                      −{formatPercent(nextTier.discountPercent)}
                      ) — noch{" "}
                      {(nextTier.minQty - quantity).toLocaleString("de-DE")}{" "}
                      Stk. bis dahin.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <Field
                label="EK / Stück überschreiben (€)"
                hint="Optional — sonst gilt der berechnete Preis."
              >
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice || ""}
                  onChange={(e) => {
                    setPriceManual(true);
                    setUnitPrice(Number(e.target.value) || 0);
                  }}
                />
              </Field>
            </>
          )}
        </section>

        <section>
          <CostItemEditor
            title="Beschaffungskosten"
            items={costItems}
            onChange={setCostItems}
            allowedPhases={PROCUREMENT_PHASES}
          />
        </section>

        <section>
          <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-soft">
            Verkauf
          </h3>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Field label="Händler">
              <Select
                value={dealerId}
                onChange={(e) => {
                  const id = e.target.value;
                  setDealerId(id);
                  const next = data.dealers.find((d) => d.id === id);
                  if (!next) {
                    setSellPrice(0);
                    setSalesItems([]);
                    return;
                  }
                  const sales = salesFromDealer(next);
                  setSellPrice(sales.sellPrice);
                  setSalesItems(sales.costItems);
                }}
              >
                <option value="">Händler wählen…</option>
                {[...data.dealers]
                  .filter((d) => d.status === "active")
                  .sort((a, b) => a.name.localeCompare(b.name, "de"))
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.defaultSellPrice > 0
                        ? ` · VK ${formatEuro(d.defaultSellPrice)}`
                        : ""}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field
              label="Verkaufspreis / Stück"
              hint={
                dealer
                  ? `Von ${dealer.name} — Änderung nur beim Händler.`
                  : "Erscheint nach Händler-Auswahl."
              }
            >
              <div className="flex h-[34px] items-center rounded-[8px] border border-line bg-surface-faint px-3 text-[13px] tabular-nums text-foreground">
                {sellPrice > 0 ? formatEuro(sellPrice) : "—"}
              </div>
            </Field>
          </div>
          <SalesCostsReadonly
            items={salesItems}
            emptyHint="Händler wählen, um Vertriebskosten zu sehen."
          />
        </section>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={!canSave}>
            Charge speichern
          </Button>
        </div>
      </form>
    </Modal>
  );
}
