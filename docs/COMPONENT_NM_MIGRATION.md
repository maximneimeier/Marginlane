# Migrationsplan: Komponenten vom Produkt entkoppeln (n:m)

**Status:** Umgesetzt (JSON-`AppData` via `migrateAppData`) — 2026-08-11  
**Scope:** JSON-`AppData` (Workspace-Blob). Prisma-Relationierung folgt später mit diesem Zielmodell.

---

## 1. Ausgangslage

| Heute | Problem |
|-------|---------|
| `Component` hat `productId` + `quantityPerProductUnit` | 1:1 an ein Produkt gebunden |
| Gleiches Teil in 2 Produkten = 2 komplette Component-Zeilen | Doppelte Pflege von Name/Lieferant/EK |
| Keine Gesamtsicht „Komponente → Produkte“ | Keine Wiederverwendung |

Aktuelles Shape (inkl. bereits vorhandener Felder aus vorherigem Fix):

```ts
Component {
  id, productId, supplierId, name, sku, currency, purchasePricePerUnit,
  quantityPerProductUnit, notes
}
```

---

## 2. Zielmodell

### 2.1 Stammdatensatz `Component` (ohne Produktbezug)

```ts
Component {
  id: string;
  supplierId: string;          // "" = kein Lieferant (wie bisher)
  name: string;
  sku: string;                 // optional (leer erlaubt)
  currency: string | null;     // null = vom Lieferanten erben
  purchasePricePerUnit: number;
  notes: string;
}
```

**Entfernt von Component:** `productId`, `quantityPerProductUnit`.

### 2.2 Verknüpfung `ProductComponent` (n:m)

```ts
ProductComponent {
  id: string;
  productId: string;           // → CatalogProduct
  componentId: string;         // → Component
  quantityPerProductUnit: number;
  /** null/undefined = Standard-EK der Component nutzen */
  purchasePriceOverride: number | null;
}
```

### 2.3 `AppData`

```ts
AppData {
  …
  components: Component[];
  productComponents: ProductComponent[];  // NEU
  …
}
```

### 2.4 EK-Formel (unverändert im Ergebnis)

Pro Katalogprodukt:

```
unitPurchase =
  Σ over ProductComponent where productId = P:
    effectivePrice(pc) × pc.quantityPerProductUnit

effectivePrice(pc) =
  pc.purchasePriceOverride ?? component.purchasePricePerUnit
```

`catalogProductUnitPurchaseCost` / `resolveUnitPurchasePrice` nutzen den Join statt `components.filter(c => c.productId === …)`.

### 2.5 Prisma (später)

Wenn JSON→Tabellen migriert werden: Tabellen `Component` + `ProductComponent` mit FKs wie oben — **dieses** Zielmodell direkt, nicht das alte 1:1. Keine separate zweite Prisma-Migration nur für n:m.

---

## 3. Datenmigration (idempotent, kein Verlust)

Ort: `migrateAppData` (wie bisher bei Shape-Änderungen).

### Algorithmus

1. Input lesen (`components`, optional schon `productComponents`).
2. **Fall A — bereits migriert:**  
   `productComponents` ist Array **und** kein Component hat mehr `productId` →  
   nur normalisieren (Defaults für `sku`/`currency`/`notes`/`purchasePriceOverride`).
3. **Fall B — Legacy:**  
   Für jedes alte Component-Objekt mit `productId`:
   - Neues `Component` (gleiche `id`, ohne `productId`/`quantityPerProductUnit`)
   - Neues `ProductComponent`:
     - `id = createId("pc")` (oder deterministisch `pc_${oldId}` für Idempotenz)
     - `productId` = alter Wert
     - `componentId` = alte Component-`id`
     - `quantityPerProductUnit` = alter Wert (Default 1)
     - `purchasePriceOverride` = `null`
4. **Kein Deduplizieren** gleichnamiger Komponenten — 1 alte Zeile → 1 Component + 1 Link.
5. Legacy-Pfad „altes Product → CatalogProduct + Component“ anpassen: ebenfalls Component + ProductComponent erzeugen.
6. Output: `products: []`, normalisierte `components`, gefülltes `productComponents`.

### Rollback

- Vor Deploy: Backup `Workspace.data` / `pg_dump`.
- Reverse nur manuell möglich (Link + Stammdaten wieder zusammenführen) — daher Cutover erst nach Smoke-Test.

### Erfolgscheck nach Migration

- Anzahl Legacy-Components = Anzahl neuer Components = Anzahl ProductComponents (bei reiner 1:1-Überführung ohne vorherige n:m-Daten).
- Für jedes Produkt: `catalogProductUnitPurchaseCost` vor/nach (auf Snapshot) identisch.
- Bestehende Batches: `calculateResolvedEconomics` unverändert.

---

## 4. Code-Anpassungen (Reihenfolge der Umsetzung)

| Schritt | Was |
|---------|-----|
| 1 | Typen in `types.ts` + `EMPTY_DATA.productComponents: []` |
| 2 | `migrateAppData` + `emptyComponent` / `emptyProductComponent` |
| 3 | `catalogProductUnitPurchaseCost`, `resolve.ts`, Tests |
| 4 | `validateAppData` (FK product/component, qty ≥ 0, Override ≥ 0) |
| 5 | `StoreContext`: upsert/delete Component + ProductComponent; Cascade beim Produkt-Löschen; Component-Löschen blockieren wenn Links existieren |
| 6 | UI: `ComponentFormModal` Wege a/b; Komponenten-Liste mit #Produkte |
| 7 | `CatalogProductFormModal` BOM über ProductComponent |
| 8 | Export-CSV, Supplier-Overview, sonstige Filter die `component.productId` nutzen |
| 9 | Unit-Tests Migration + EK-Join + resolve |

---

## 5. UI-Verhalten (kurz)

### Formular

- **(a) Neue Komponente:** Stammdaten + Produkt + Menge → speichert Component + ProductComponent.
- **(b) Bestehende verwenden:** Dropdown Katalog → nur Produkt + Menge (+ optional Override) → nur ProductComponent.

### Stammliste `/components`

Spalten: Name, SKU, Lieferant, Standard-EK, **# Produkte**, optional Summe `quantityPerProductUnit` über Links.

### Löschen

- Component mit ≥1 `ProductComponent`: Dialog mit Produktnamen, Löschen erst nach Bestätigung **oder** hart blockieren bis Links entfernt — **Empfehlung:** Warnung + Liste, Löschen entfernt optional zuerst die Links (mit expliziter Bestätigung) **oder** verhindert Löschen.  
  → **Vorschlag zur Freigabe:** Löschen **verhindern**, solange Links existieren; User entfernt Verknüpfungen am Produkt zuerst. Sicherer für Demo.

---

## 6. Explizit nicht in Scope

- Automatisches Mergen gleichnamiger Komponenten
- Lagerbestand / Zwischenprodukte
- Relationales Prisma-Rewrite (nur Zielmodell vormerken)
- Auth / Multi-Tenancy

---

## 7. Offene Entscheidung (bitte kurz bestätigen)

1. **Component löschen bei vorhandenen Links:** verhindern (Empfehlung) vs. Cascade mit Warnung?
2. **`purchasePriceOverride` in UI der ersten Iteration:** mitbauen oder Feld nur im Modell + später UI?

Nach Freigabe: Umsetzung in der Reihenfolge §4.
