# Deployment (Demo)

Marginlane is a Next.js 16 app with Prisma 7 + PostgreSQL. For a **demo**, a single shared workspace (`id = "default"`) is enough — no auth yet.

## Recommended stack

| Piece | Suggestion |
|-------|------------|
| App | [Vercel](https://vercel.com) (or any Node host with `next start`) |
| Database | Managed Postgres: [Neon](https://neon.tech), [Supabase](https://supabase.com), [Railway](https://railway.app), or self-hosted |

## Steps

1. **Create a Postgres database** and copy the connection string.
2. Set env vars on the host:
   - `DATABASE_URL` — required (see `.env.example`)
3. **Migrate schema** (from CI or once locally against prod URL):

   ```bash
   npx prisma migrate deploy
   ```

4. **Build & run**

   ```bash
   npm ci
   npm run build
   npm start
   ```

   On Vercel: connect the GitHub repo, set `DATABASE_URL`, enable build command `prisma generate && next build` (already in `package.json` `build` script). Run `prisma migrate deploy` via a one-off job or Vercel build hook:

   ```bash
   # example build command if you want migrate on every deploy
   prisma migrate deploy && prisma generate && next build
   ```

5. Open the app URL — data persists in Postgres as one JSON workspace document until a later relational migration.

## Local demo

```bash
cp .env.example .env
# start Postgres, then:
npx prisma migrate dev
npm run dev
```

## Notes

- **No multi-tenancy / login** in this demo build — anyone with the URL can read/write the workspace API.
- Phase-2 features stay behind flags in `src/lib/features.ts`.
- CSV export lives under **Einstellungen → Datenexport**.
