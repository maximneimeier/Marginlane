# Marginlane

Unit Economics für Importeure: vom Lieferanten bis zur Marge — mit Landed Cost, BOM-Komponenten, Chargen und Händlern.

## Start (lokal)

1. Postgres bereitstellen und `.env` anlegen:

```bash
cp .env.example .env
# DATABASE_URL anpassen
```

2. Schema + App:

```bash
npx prisma migrate dev
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000). Daten liegen in PostgreSQL (Workspace-Dokument).

## Scripts

| Script | Zweck |
|--------|--------|
| `npm run dev` | Entwicklungsserver |
| `npm run build` / `start` | Produktion |
| `npm test` | Unit-Tests (Vitest) |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run db:studio` | Prisma Studio |

## Features (Demo-MVP)

- **Produkte & Komponenten** — Verkaufskatalog + BOM mit Lieferanten-Vererbung (Währung)
- **Lieferanten & Händler** — Konditionen, Defaults für Verkauf
- **Chargen** — Menge, EK, Kostenposten (pro Stück / pauschal / % Warenwert), inkl. Montage/Repacking
- **Unit Economics** — Wasserfall Einkauf → Landed Cost → Vertrieb → Nettomarge
- **Gemeinkosten** — Sektion in der Overview (Verteilschlüssel)
- **CSV-Export** — unter Einstellungen (Lieferanten, Produkte, Komponenten, Chargen)

Phase-2 (Absatzplan, Konsolidierung, …) ist per Feature-Flags ausgeschaltet (`src/lib/features.ts`).

## Deploy

Siehe [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
