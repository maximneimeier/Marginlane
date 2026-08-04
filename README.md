# Marginlane

Unit Economics für Importeure und E-Commerce: vom Lieferanten bis zur Marge — mit Landed Cost, Chargen und Händlern.

## Start

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000). Daten liegen lokal im Browser (`localStorage`).

## Features

- **Lieferanten & Produkte** — Kontakt, Zahlungskonditionen, MOQ, Rabattstaffeln
- **Händler** — Abnehmer mit Standard-VK und Vertriebskosten
- **Chargen** — Menge, EK, beliebig viele Kostenposten (pro Stück / pauschal / % Warenwert)
- **Landed Cost** — automatische Umlegung der Beschaffungskosten aufs Stück
- **Unit Economics** — Wasserfall Einkauf → Landed Cost → Vertrieb → Nettomarge

## Datenmodell

```
Lieferant → Produkt → Charge → Händler
                       ├─ Kostenposten[] (Beschaffung)
                       └─ Verkauf + Kostenposten[] (Vertrieb)
```

Neue Kostenarten brauchen kein Schema-Update — nur einen weiteren Posten-Typ.
