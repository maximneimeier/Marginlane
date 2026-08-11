# Datenmodell-Migration: JSON-Blob → relationale Tabellen

**Status:** Plan (noch nicht implementiert)  
**Stand:** 2026-08-11  
**Scope:** MVP-Reife, Punkt 2 — Auth/Multi-Tenancy bewusst **ausgenommen** (folgt später)

---

## 1. Ausgangslage

| Heute | Problem |
|-------|---------|
| Ein `Workspace`-Record (`id = "default"`) | Kein granularer Zugriff |
| Gesamtes `AppData` als `Json`/`JSONB` | Jeder Save schreibt das komplette Dokument |
| Client lädt/schreibt via `GET/PUT /api/workspace` | Keine serverseitige Feld-Validierung, Race Conditions bei parallelen Edits möglich |
| IDs sind Client-`cuid`/ähnliche Strings | Bleiben erhalten (kein Rewrite der Frontend-IDs) |

**Nicht Teil dieses Plans:** User, Session, Workspace-Membership. Schema und Migration bleiben so, dass später `workspaceId` an alle Tabellen gehängt werden kann, ohne erneute Daten-Neuanlage.

---

## 2. Zielbild (Prisma)

### 2.1 Workspace (bleibt, JSON nur noch als Fallback/Übergang)

```
Workspace
  id          String  @id          // vorerst weiter "default"
  updatedAt   DateTime
  // data Json  → nach erfolgreicher Cutover-Migration ENTFERNEN (oder als archived blob behalten)
  settings    Json?               // salesPlanSettings + ggf. Prefs ohne Auth
```

Während der Migration: Spalte `data` **behalten**, bis Cutover verifiziert ist (Rollback-Pfad).

### 2.2 Kern-Tabellen (MVP, 1:1 zu `src/lib/types.ts`)

```
Supplier
CatalogProduct          // ehem. catalogProducts[]
Component               // BOM: productId → CatalogProduct, supplierId → Supplier
Dealer
Batch                   // productId → CatalogProduct, supplierId → Supplier
BatchCostItem           // CostItem an Batch (Beschaffung)
Sale                    // an Batch; optional dealerId → Dealer
SaleCostItem            // CostItem an Sale (oder null = Inherit vom Dealer — siehe §4)
DealerSalesCostItem     // Vorlage CostItem am Dealer

OverheadItem
OverheadManualShare     // nur bei verteilschluessel = manuell
OverheadActual

SalesPlanCell           // composite unique (productId, dealerId, month, scenario)
SalesPlanRowMeta        // composite unique (productId, dealerId, scenario)
```

**Legacy `products[]`:** nicht als Tabelle — bleibt leer / nur Importpfad in `migrateAppData`.

### 2.3 Foreign Keys (vereinfacht)

```
Component.productId     → CatalogProduct.id  ON DELETE CASCADE
Component.supplierId    → Supplier.id        ON DELETE RESTRICT (oder SET NULL — Entscheidung §5)
Batch.productId         → CatalogProduct.id  ON DELETE RESTRICT
Batch.supplierId        → Supplier.id        ON DELETE RESTRICT
BatchCostItem.batchId   → Batch.id           ON DELETE CASCADE
Sale.batchId            → Batch.id           ON DELETE CASCADE
Sale.dealerId           → Dealer.id          ON DELETE SET NULL
SaleCostItem.saleId     → Sale.id            ON DELETE CASCADE
DealerSalesCostItem.dealerId → Dealer.id     ON DELETE CASCADE
OverheadManualShare.overheadItemId → OverheadItem.id CASCADE
OverheadManualShare.productId → CatalogProduct.id RESTRICT
OverheadActual.overheadItemId → OverheadItem.id SET NULL
SalesPlanCell.productId → CatalogProduct.id CASCADE
SalesPlanCell.dealerId  → Dealer.id SET NULL
```

Alle Tabellen bekommen später (Auth): `workspaceId → Workspace.id`. **Jetzt** entweder:

- **Variante A (empfohlen):** Spalte `workspaceId` mit Default `"default"` und FK schon jetzt anlegen, oder  
- **Variante B:** ohne `workspaceId`, alles implizit single-tenant, bei Auth nachziehen.

→ **Empfehlung: Variante A**, damit Auth nur Membership + Middleware braucht, keine zweite Daten-Migration.

### 2.4 Typ-Mapping (Auszug)

| TypeScript | Postgres |
|------------|----------|
| `string` IDs | `String @id` (bestehende IDs behalten) |
| `createdAt` ISO-String | `DateTime` (parse) oder `String` belassen — **Empfehlung DateTime** |
| Enums (`CostPhase`, …) | Prisma `enum` oder `String` — **Empfehlung String** (weniger Migrationsschmerz, Validierung in Zod) |
| nested `CostItem[]` | eigene Kind-Tabellen |
| `CommercialOverrides` nullables | Spalten auf `Batch` nullable |
| `DiscountTier` (aktuell nur an deprecated Product) | vorerst **nicht** relational, außer wir brauchen sie an Component — aktuell ungenutzt im MVP-BOM |

---

## 3. Migrationsphasen (ohne Datenverlust)

### Phase 0 — Vorbereitung
- Backup: `pg_dump` der aktuellen DB (oder Export `Workspace.data` als JSON-Datei ins Repo-fremde Backup).
- Feature-Flag / Env: `DATA_STORE=json | relational | dual` (siehe Phase 2).
- Unit-Tests für Calc/Resolve können parallel laufen (Punkt 4) — unabhängig von Persistenz.

### Phase 1 — Schema hinzufügen (additive Migration)
- Prisma-Migration: neue Tabellen + `workspaceId` Default `"default"`.
- Spalte `Workspace.data` **bleibt**.
- Kein Write auf neue Tabellen noch.

### Phase 2 — ETL: JSON → Relationen (einmalig / idempotent)
Skript z. B. `scripts/migrate-json-to-relational.ts`:

1. `SELECT id, data FROM "Workspace"`
2. `migrateAppData(data)` (bestehende Normalisierung)
3. In einer Transaction pro Workspace:
   - Upsert aller Entities in FK-Reihenfolge: Supplier → CatalogProduct → Component/Dealer → Batch → CostItems/Sales → Overhead → SalesPlan
4. Idempotenz: Upsert by `id`; Kind-Tabellen: delete-orphans oder „replace children for parent“
5. Validierung nach Lauf:
   - Counts JSON vs. DB (`suppliers.length === count(*)`, …)
   - Stichprobe: 1 Batch Economics vorher/nachher identisch (`calculateResolvedEconomics`)
6. Ergebnis loggen; bei Diff → Abort, JSON unverändert lassen

### Phase 3 — Dual-Read / Dual-Write (optional, empfohlen 1 Release)
- Read: relational, bei leeren Tabellen Fallback JSON
- Write: relational **und** JSON aktualisieren (oder nur relational + periodischer Snapshot)
- Ziel: Rollback in Minuten möglich

### Phase 4 — Cutover
- Env `DATA_STORE=relational`
- API: statt `PUT` ganzes AppData → resource-Routen oder weiterhin kompatibler Aggregate-Endpoint, der intern relational schreibt
- `StoreContext` kann vorerst weiter „AppData im Speicher“ halten und per Entity speichern — oder schrittweise granular

### Phase 5 — Cleanup
- Nach Verifikation (Staging + Prod): Spalte `data` droppen **oder** in `Workspace.dataArchive` umbenennen und nur noch lesen
- `storage.ts`: Normalizer behalten wo nötig; Persistenz-Reste/localStorage-Cleanup im Store prüfen — Datei **nicht** blind löschen (enthält Normalizer + Dealer-Sale-Helpers)

---

## 4. Sonderfälle / Design-Entscheidungen

### 4.1 Sale.costItems === null (Inherit)
- DB: keine `SaleCostItem`-Zeilen + Flag `costItemsInherited Boolean @default(true)`  
  **oder** Sentinel: fehlende Rows = inherit (weniger explizit).  
→ **Empfehlung: explizites Flag** `inheritCostItems`.

### 4.2 Batch.unitPurchasePrice === null (BOM)
- Spalte nullable `Decimal?` / `Float?` — null = aus Components berechnen (Logik bleibt in `resolve.ts`).

### 4.3 CostItem.id
- Bleibt Client-generiert; Unique pro Parent reicht (`@@unique([batchId, id])` oder global unique `id`).

### 4.4 Decimal vs Float
- Geldbeträge: Prisma `Decimal` bevorzugen; Frontend weiter `number` am API-Rand (parse).  
  Alternative MVP: `Float` wie bisher im JSON — schneller, weniger präzise.  
→ **Empfehlung MVP: Float/Double** wie bisher, später Decimal.

### 4.5 API-Schnittstelle
Zwei Wege:

| Weg | Beschreibung |
|-----|----------------|
| **Kompatibel** | `GET/PUT /api/workspace` bleibt; Server lädt/schreibt relational und serialisiert zu `AppData` |
| **Granular** | `/api/suppliers`, `/api/batches/[id]`, … |

→ **Empfehlung:** zuerst **kompatibel** (StoreContext bleibt), parallel Validation im PUT; danach schrittweise granular. Weniger UI-Risiko.

### 4.6 Concurrent Writes
- Heute: last-write-wins auf ganzem JSON.  
- Relational: weiterhin last-write-wins pro Entity, solange Client Aggregate-PUT macht.  
- Später: `updatedAt`-Optimistic-Locking pro Workspace oder Entity.

---

## 5. Offene Punkte (vor Implementierung klären)

1. **Component.supplierId löschen:** RESTRICT (Supplier erst archivieren) vs. CASCADE/SET — aktuell UI cascaded oft soft.  
2. **Dual-Write-Phase:** ja (sicherer) oder Big-Bang Cutover lokal ok?  
3. **Auth später:** Variante A (`workspaceId` jetzt) bestätigen.

---

## 6. Rollback

| Zeitpunkt | Aktion |
|-----------|--------|
| Nach Phase 1 | Migration down / Tabellen droppen, JSON unberührt |
| Nach Phase 2 | Tabellen truncate; App liest weiter JSON |
| Nach Phase 3 | `DATA_STORE=json` |
| Nach Phase 5 (data dropped) | Nur aus Backup (`pg_dump` / Archive-Spalte) |

**Hard rule:** `Workspace.data` erst droppen, wenn Counts + Economics-Stichproben grün und mind. ein manuelles Smoke-Test durch ist.

---

## 7. Erfolgskriterien

- [ ] Alle Entities aus aktuellem `default`-Workspace vollständig in Tabellen
- [ ] `calculateResolvedEconomics` für bestehende Batches unverändert
- [ ] App startet mit `DATA_STORE=relational` ohne sichtbare Regression
- [ ] JSON-Spalte noch vorhanden **oder** bewusst archiviert
- [ ] Kein Auth nötig für diesen Cutover

---

## 8. Nächster Schritt

Nach Freigabe der offenen Punkte (§5): Prisma-Schema + Phase-1-Migration + ETL-Skript implementieren, danach API-Adapter.
